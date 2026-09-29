import ollama from 'ollama';

import channels from '../common/channels.cjs';
import { secureHandle } from './ipc-guards.js';

export function registerOllamaIpcHandlers() {
  secureHandle(channels.ollama.isRunning, async () => {
    try {
      await ollama.list();
      return true;
    } catch {
      return false;
    }
  });

  secureHandle(channels.ollama.listModels, async () => {
    const response = await ollama.list();
    const models = await Promise.all(
      response.models.map(async (model) => {
        try {
          const detail = await ollama.show({
            model: model.model,
          });

          return {
            ...model,
            capabilities: detail.capabilities ?? [],
          };
        } catch {
          return {
            ...model,
            capabilities: [],
          };
        }
      }),
    );

    return { models };
  });
}
