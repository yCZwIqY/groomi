import channels from '../common/channels.cjs';
import type { createWorkspaceService } from '../services/workspace-service.js';
import { optionalString, requireString, secureHandle } from './ipc-guards.js';
import { getAiCredentials } from '../services/ai-credentials.js';
import { listOpenRouterModels, requestOpenRouter } from '../services/ai-provider.js';
import { getOpenRouterUsageStore } from '../services/openrouter-usage.js';

export function registerSettingIpcHandlers(
  workspaceService: ReturnType<typeof createWorkspaceService>,
) {
  const publicSettings = async () => ({
    ...(await workspaceService.getSettingInfo()),
    hasOpenRouterKey: await (await getAiCredentials()).hasKey(),
  });
  secureHandle(channels.setting.getInfo, async () => {
    return publicSettings();
  });

  secureHandle(channels.setting.updateAiSettings, async (_, provider, model) => {
    if (provider !== 'ollama' && provider !== 'openrouter')
      throw new Error('잘못된 AI 제공자입니다.');
    const modelId = optionalString(model, 'model')?.trim() || null;
    if (modelId && (modelId.length > 200 || !/^[a-zA-Z0-9/_.:+-]+$/.test(modelId))) {
      throw new Error('잘못된 모델 ID입니다.');
    }
    await workspaceService.updateAiSettings(provider, modelId);
    return publicSettings();
  });
  secureHandle(channels.setting.saveOpenRouterKey, async (_, key) => {
    await (await getAiCredentials()).saveKey(requireString(key, 'key'));
  });
  secureHandle(channels.setting.deleteOpenRouterKey, async () => {
    await (await getAiCredentials()).deleteKey();
  });
  secureHandle(channels.setting.checkOpenRouter, async () => {
    const key = await (await getAiCredentials()).readKey();
    await requestOpenRouter('key', key);
  });
  secureHandle(channels.setting.listOpenRouterModels, () => listOpenRouterModels());
  secureHandle(channels.setting.getOpenRouterUsage, async () => {
    const key = await (await getAiCredentials()).readKey();
    const [remote, local] = await Promise.allSettled([
      requestOpenRouter('key', key),
      getOpenRouterUsageStore().then((store) => store.read(key)),
    ]);
    const number = (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
    const data = remote.status === 'fulfilled' ? remote.value?.data : null;
    const free = data?.free_model_daily_requests;
    return {
      key: data
        ? {
            usedCredits: number(data.usage),
            dailyCredits: number(data.usage_daily),
            monthlyCredits: number(data.usage_monthly),
            limit: number(data.limit),
            remainingCredits: number(data.limit_remaining),
            unlimited: data.limit === null,
            freeRequests: free
              ? {
                  used: number(free.used),
                  limit: number(free.limit),
                  remaining: number(free.remaining),
                }
              : null,
          }
        : null,
      local: local.status === 'fulfilled' ? local.value : null,
      remoteError:
        remote.status === 'rejected'
          ? remote.reason instanceof Error
            ? remote.reason.message
            : '키 사용량을 조회하지 못했습니다.'
          : null,
      localError: local.status === 'rejected' ? 'Groomi 사용량 기록을 읽지 못했습니다.' : null,
      updatedAt: new Date().toISOString(),
    };
  });

  secureHandle(channels.setting.updateSelectedEmbeddingModel, async (_, selectedEmbeddingModel) => {
    await workspaceService.updateSelectedEmbeddingModel(
      optionalString(selectedEmbeddingModel, 'selectedEmbeddingModel') ?? null,
    );
    return publicSettings();
  });

  secureHandle(channels.setting.updateSelectedLLMModel, async (_, selectedLLMModel) => {
    await workspaceService.updateSelectedLLMModel(
      optionalString(selectedLLMModel, 'selectedLLMModel') ?? null,
    );
    return publicSettings();
  });
}
