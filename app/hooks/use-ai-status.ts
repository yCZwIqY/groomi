import { useLanguage } from '~/stores/use-language';
import { getErrorMessage } from '~/lib/app-error';
import { useCallback, useEffect, useState } from 'react';
import { getSettingInfo } from '~/lib/electron/setting-api';
import { getOllamaRunning } from '~/lib/ollama-api';

export async function getAiStatus() {
  const setting = await getSettingInfo();
  const provider = setting.aiProvider;
  const model = provider === 'openrouter' ? setting.openRouterModel : setting.selectedLLMModel;
  const label = `${provider === 'openrouter' ? 'OpenRouter' : 'Ollama'}${model ? ` · ${model}` : ''}`;
  let code:
    | 'OPENROUTER_KEY_SETUP_REQUIRED'
    | 'AI_MODEL_REQUIRED'
    | 'OLLAMA_NOT_RUNNING'
    | undefined;
  if (provider === 'openrouter' && !setting.hasOpenRouterKey)
    code = 'OPENROUTER_KEY_SETUP_REQUIRED';
  else if (!model) code = 'AI_MODEL_REQUIRED';
  else if (provider === 'ollama' && !(await getOllamaRunning())) code = 'OLLAMA_NOT_RUNNING';
  const issue = code ? getErrorMessage('GROOMI_ERROR:' + code) : '';
  return { label, issue, code, ready: !code };
}

export function useAiStatus(documentPath: string) {
  const language = useLanguage((state) => state.language);
  const [status, setStatus] = useState({ label: '', issue: '', ready: false });
  const [checking, setChecking] = useState(true);
  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await getAiStatus());
    } catch {
      setStatus({
        label: '',
        issue: getErrorMessage('GROOMI_ERROR:AI_SETTINGS_CHECK_FAILED'),
        ready: false,
      });
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [documentPath, refresh, language]);
  return { ...status, checking, refresh };
}
