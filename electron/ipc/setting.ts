import channels from '../common/channels.cjs';
import type { createWorkspaceService } from '../services/workspace-service.js';
import { optionalString, requireString, secureHandle } from './ipc-guards.js';
import { getAiCredentials } from '../services/ai-credentials.js';
import { listOpenRouterModels, requestOpenRouter } from '../services/ai-provider.js';

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
