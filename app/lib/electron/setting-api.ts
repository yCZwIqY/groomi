import { requireElectronApi } from './client';

export async function getSettingInfo() {
  return requireElectronApi().getSettingInfo();
}

export async function updateSelectedEmbeddingModel(selectedEmbeddingModel: string | null) {
  return requireElectronApi().updateSelectedEmbeddingModel(selectedEmbeddingModel);
}

export async function updateSelectedLLMModel(selectedLLMModel: string | null) {
  return requireElectronApi().updateSelectedLLMModel(selectedLLMModel);
}

export async function updateAiSettings(provider: AiProvider, model: string | null) {
  return requireElectronApi().updateAiSettings(provider, model);
}
export async function saveOpenRouterKey(key: string) {
  return requireElectronApi().saveOpenRouterKey(key);
}
export async function deleteOpenRouterKey() {
  return requireElectronApi().deleteOpenRouterKey();
}
export async function checkOpenRouter() {
  return requireElectronApi().checkOpenRouter();
}
export async function listOpenRouterModels() {
  return requireElectronApi().listOpenRouterModels();
}
