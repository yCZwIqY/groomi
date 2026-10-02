import { useCallback, useEffect, useState } from 'react';
import { getSettingInfo } from '~/lib/electron/setting-api';
import { getOllamaRunning } from '~/lib/ollama-api';

export async function getAiStatus() {
  const setting = await getSettingInfo();
  const provider = setting.aiProvider;
  const model = provider === 'openrouter' ? setting.openRouterModel : setting.selectedLLMModel;
  const label = `${provider === 'openrouter' ? 'OpenRouter' : 'Ollama'}${model ? ` · ${model}` : ''}`;
  let issue = '';
  if (provider === 'openrouter' && !setting.hasOpenRouterKey)
    issue = '설정에서 OpenRouter API 키를 등록해주세요.';
  else if (!model) issue = '설정에서 AI 모델을 선택해주세요.';
  else if (provider === 'ollama' && !(await getOllamaRunning()))
    issue = 'Ollama를 실행한 뒤 다시 확인해주세요.';
  return { label, issue, ready: !issue };
}

export function useAiStatus(documentPath: string) {
  const [status, setStatus] = useState({ label: '', issue: '', ready: false });
  const [checking, setChecking] = useState(true);
  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await getAiStatus());
    } catch {
      setStatus({
        label: '',
        issue: 'AI 설정을 확인하지 못했습니다. 다시 확인해주세요.',
        ready: false,
      });
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [documentPath, refresh]);
  return { ...status, checking, refresh };
}
