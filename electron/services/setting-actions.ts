import type { AiProvider } from './ai-provider.js';
import type { WorkspaceServiceContext } from './workspace-service-context.js';

export function createSettingActions(context: WorkspaceServiceContext) {
  async function getSettingInfo() {
    const workspacePath = await context.getCurrentWorkspacePath();

    return context.withWorkspaceRepositories(workspacePath, async ({ settingInfo }) => {
      return settingInfo.findSettingInfo();
    });
  }

  async function updateSelectedEmbeddingModel(selectedEmbeddingModel: string | null) {
    const workspacePath = await context.getCurrentWorkspacePath();

    await context.withWorkspaceRepositories(workspacePath, async ({ settingInfo }) => {
      await settingInfo.updateSelectedEmbeddingModel(selectedEmbeddingModel);
    });

    return getSettingInfo();
  }

  async function updateSelectedLLMModel(selectedLLMModel: string | null) {
    const workspacePath = await context.getCurrentWorkspacePath();

    await context.withWorkspaceRepositories(workspacePath, async ({ settingInfo }) => {
      await settingInfo.updateSelectedLLMModel(selectedLLMModel);
    });

    return getSettingInfo();
  }

  async function updateAiSettings(provider: AiProvider, model: string | null) {
    const workspacePath = await context.getCurrentWorkspacePath();
    await context.withWorkspaceRepositories(workspacePath, async ({ settingInfo }) => {
      await settingInfo.updateAiSettings(provider, model);
    });
    return getSettingInfo();
  }

  async function updateOutputLanguage(language: 'auto' | 'ko' | 'en') {
    const workspacePath = await context.getCurrentWorkspacePath();
    await context.withWorkspaceRepositories(workspacePath, async ({ settingInfo }) => {
      await settingInfo.updateOutputLanguage(language);
    });
    return getSettingInfo();
  }

  return {
    updateOutputLanguage,
    updateAiSettings,
    getSettingInfo,
    updateSelectedEmbeddingModel,
    updateSelectedLLMModel,
  };
}
