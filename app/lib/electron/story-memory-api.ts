import { requireElectronApi } from './client';

export async function generateStoryMemory(documentPath: string) {
  return requireElectronApi().generateStoryMemory(documentPath);
}

export async function saveStoryMemory(documentPath: string, draft: StoryMemoryDraft) {
  return requireElectronApi().saveStoryMemory(documentPath, draft);
}

export async function getLatestStoryMemory(groupPath: string) {
  return requireElectronApi().getLatestStoryMemory(groupPath);
}
