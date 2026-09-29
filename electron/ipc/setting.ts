import channels from '../common/channels.cjs';
import type { createWorkspaceService } from '../services/workspace-service.js';
import { optionalString, secureHandle } from './ipc-guards.js';

export function registerSettingIpcHandlers(
  workspaceService: ReturnType<typeof createWorkspaceService>,
) {
  secureHandle(channels.setting.getInfo, async () => {
    return workspaceService.getSettingInfo();
  });

  secureHandle(channels.setting.updateSelectedEmbeddingModel, async (_, selectedEmbeddingModel) => {
    return workspaceService.updateSelectedEmbeddingModel(
      optionalString(selectedEmbeddingModel, 'selectedEmbeddingModel') ?? null,
    );
  });

  secureHandle(channels.setting.updateSelectedLLMModel, async (_, selectedLLMModel) => {
    return workspaceService.updateSelectedLLMModel(
      optionalString(selectedLLMModel, 'selectedLLMModel') ?? null,
    );
  });
}
