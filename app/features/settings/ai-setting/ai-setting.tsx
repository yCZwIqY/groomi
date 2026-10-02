import { useCallback, useEffect, useState } from 'react';
import SettingsSection from '~/components/common/settings-section';
import { DnSelect } from '~/components/common/selector';
import DnButton from '~/components/common/buttons/dn-button';
import DnInput from '~/components/common/inputs/dn-input';
import {
  getSettingInfo,
  updateAiSettings,
  updateSelectedLLMModel,
  saveOpenRouterKey,
  deleteOpenRouterKey,
  checkOpenRouter,
  listOpenRouterModels,
} from '~/lib/electron/setting-api';
import { getOllamaModels, getOllamaRunning, type OllamaModel } from '~/lib/ollama-api';
import { showToast } from '~/lib/toast-manager';
import { describeOpenRouterModel } from '~/lib/ai-model-options';
import RecommendedFreeModels from './recommended-free-models';
import RecommendedPaidModels from './recommended-paid-models';
import OpenRouterUsagePanel from './openrouter-usage-panel';

const AiSetting = () => {
  const [setting, setSetting] = useState<Setting | null>(null);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [routerModels, setRouterModels] = useState<OpenRouterModel[]>([]);
  const [ollamaRunning, setOllamaRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState('');
  const [connection, setConnection] = useState('');
  const [error, setError] = useState('');
  const [usageVersion, setUsageVersion] = useState(0);

  const loadModels = useCallback(async (provider: AiProvider) => {
    if (provider === 'openrouter') {
      setRouterModels(await listOpenRouterModels());
    } else {
      const running = await getOllamaRunning();
      setOllamaRunning(running);
      setOllamaModels(
        running
          ? (await getOllamaModels()).models.filter((model) =>
              model.capabilities.includes('completion'),
            )
          : [],
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const saved = await getSettingInfo();
      if (!active) return;
      setSetting(saved);
      await loadModels(saved.aiProvider);
    })()
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'AI 설정을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadModels]);

  const runAction = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '설정을 변경하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const provider = setting?.aiProvider ?? 'ollama';
  const selectedRouterModel = routerModels.find((model) => model.id === setting?.openRouterModel);
  const routerOptions = routerModels.map((model) => ({
    label: model.name,
    value: model.id,
    description: describeOpenRouterModel(model),
  }));
  if (
    setting?.openRouterModel &&
    !routerOptions.some((option) => option.value === setting.openRouterModel)
  ) {
    routerOptions.unshift({
      label: selectedRouterModel?.name ?? setting.openRouterModel,
      value: setting.openRouterModel,
      description: selectedRouterModel
        ? describeOpenRouterModel(selectedRouterModel)
        : '모델 목록에서 확인할 수 없는 저장된 모델입니다.',
    });
  }
  const ollamaOptions = ollamaModels.map((model) => ({
    label: model.model || model.name,
    value: model.model || model.name,
  }));
  if (
    setting?.selectedLLMModel &&
    !ollamaOptions.some((option) => option.value === setting.selectedLLMModel)
  ) {
    ollamaOptions.unshift({ label: setting.selectedLLMModel, value: setting.selectedLLMModel });
  }

  return (
    <SettingsSection
      collapsible
      title={'AI 모델 설정'}
      description={'댓글 생성과 회차 정보 생성에 사용할 제공자와 모델을 선택합니다.'}
    >
      <div className={'space-y-4'}>
        {loading && <p>AI 설정을 불러오는 중입니다.</p>}
        {error && (
          <p
            role={'alert'}
            className={'text-sm text-red-600'}
          >
            {error}
          </p>
        )}
        {!loading && !setting && (
          <DnButton
            disabled={busy}
            onClick={() =>
              void runAction(async () => {
                const saved = await getSettingInfo();
                setSetting(saved);
                await loadModels(saved.aiProvider);
              })
            }
          >
            다시 확인
          </DnButton>
        )}
        {setting && (
          <>
            <DnSelect
              label={'AI 제공자'}
              value={provider}
              disabled={busy || loading}
              options={[
                { label: 'Ollama · 로컬', value: 'ollama' },
                { label: 'OpenRouter · 온라인', value: 'openrouter' },
              ]}
              onChange={(value) =>
                void runAction(async () => {
                  const next = value as AiProvider;
                  setSetting(await updateAiSettings(next, setting.openRouterModel));
                  setConnection('');
                  await loadModels(next);
                })
              }
            />
            {provider === 'ollama' ? (
              <>
                <p className={'text-sm text-stone-500'}>
                  {ollamaRunning
                    ? 'Ollama 연결됨'
                    : 'Ollama를 실행하고 모델을 설치한 뒤 다시 확인해주세요.'}
                </p>
                <DnSelect
                  autocomplete
                  label={'LLM 모델'}
                  value={setting.selectedLLMModel ?? ''}
                  disabled={busy || !ollamaRunning}
                  emptyLabel={'모델을 선택해주세요'}
                  options={ollamaOptions}
                  onChange={(value) =>
                    void runAction(async () => {
                      setSetting(await updateSelectedLLMModel(String(value) || null));
                    })
                  }
                />
                <a
                  href={'https://ollama.com/download'}
                  target={'_blank'}
                  rel={'noreferrer'}
                  className={'text-sm text-blue-600'}
                >
                  Ollama 다운로드
                </a>
              </>
            ) : (
              <>
                <div className={'space-y-2'}>
                  <label
                    htmlFor={'openrouter-api-key'}
                    className={'block text-sm font-medium'}
                  >
                    OpenRouter API 키
                  </label>
                  <DnInput
                    id={'openrouter-api-key'}
                    type={'password'}
                    autoComplete={'off'}
                    spellCheck={false}
                    value={key}
                    disabled={busy}
                    onChange={(event) => setKey(event.target.value)}
                    placeholder={
                      setting.hasOpenRouterKey
                        ? 'API 키가 등록되어 있습니다. 변경할 키를 입력하세요.'
                        : '개인 API 키를 입력하세요.'
                    }
                    className={'w-full'}
                  />
                  <p className={'text-xs text-stone-500'}>
                    이 기기에 암호화하여 저장하며 워크스페이스 백업에 포함하지 않습니다.
                  </p>
                  <div className={'flex flex-wrap gap-2'}>
                    <DnButton
                      disabled={busy || !key.trim()}
                      onClick={() =>
                        void runAction(async () => {
                          await saveOpenRouterKey(key);
                          setUsageVersion((value) => value + 1);
                          setKey('');
                          setConnection('');
                          setSetting(await getSettingInfo());
                          showToast('API 키를 저장했습니다.', 'success');
                        })
                      }
                    >
                      키 저장
                    </DnButton>
                    <DnButton
                      variant={'outlined'}
                      disabled={busy || !setting.hasOpenRouterKey}
                      onClick={() =>
                        void runAction(async () => {
                          setConnection('');
                          await checkOpenRouter();
                          setUsageVersion((value) => value + 1);
                          setConnection('연결 확인 완료');
                        })
                      }
                    >
                      연결 확인
                    </DnButton>
                    <DnButton
                      variant={'outlined'}
                      disabled={busy || !setting.hasOpenRouterKey}
                      onClick={() =>
                        void runAction(async () => {
                          await deleteOpenRouterKey();
                          setUsageVersion((value) => value + 1);
                          setKey('');
                          setConnection('');
                          setSetting(await getSettingInfo());
                        })
                      }
                    >
                      키 삭제
                    </DnButton>
                    <a
                      href={'https://openrouter.ai/settings/keys'}
                      target={'_blank'}
                      rel={'noreferrer'}
                      className={'self-center text-sm text-blue-600'}
                    >
                      API 키 발급
                    </a>
                  </div>
                  <p
                    role={'status'}
                    className={'text-sm text-stone-500'}
                  >
                    {connection ||
                      (setting.hasOpenRouterKey
                        ? '키 등록됨 · 연결 확인을 눌러 유효성을 확인하세요.'
                        : '키 미등록')}
                  </p>
                </div>
                <OpenRouterUsagePanel
                  key={usageVersion}
                  hasKey={setting.hasOpenRouterKey}
                />
                <RecommendedFreeModels
                  models={routerModels}
                  selectedModel={setting.openRouterModel}
                  disabled={busy || loading}
                  onSelect={(model) =>
                    void runAction(async () => {
                      setSetting(await updateAiSettings('openrouter', model));
                    })
                  }
                />
                <RecommendedPaidModels
                  models={routerModels}
                  selectedModel={setting.openRouterModel}
                  disabled={busy || loading}
                  onSelect={(model) =>
                    void runAction(async () => {
                      setSetting(await updateAiSettings('openrouter', model));
                    })
                  }
                />
                <DnSelect
                  autocomplete
                  label={'LLM 모델'}
                  value={setting.openRouterModel ?? ''}
                  options={routerOptions}
                  disabled={busy || routerModels.length === 0}
                  emptyLabel={'모델을 선택해주세요'}
                  hint={'텍스트 입력·출력과 JSON 응답 형식을 지원하는 모델을 표시합니다.'}
                  onChange={(value) =>
                    void runAction(async () => {
                      setSetting(await updateAiSettings('openrouter', String(value) || null));
                    })
                  }
                />
                {selectedRouterModel && (
                  <p className={'text-xs text-stone-500'}>
                    {selectedRouterModel.id}
                    <br />
                    {describeOpenRouterModel(selectedRouterModel)}
                  </p>
                )}
                <p className={'rounded-lg bg-amber-50 p-3 text-xs text-amber-800'}>
                  생성 시 원고와 관련 회차 정보가 OpenRouter 및 모델 제공자에게 전송됩니다. 사용
                  요금은 본인 OpenRouter 계정에 부과됩니다.
                </p>
              </>
            )}
            <DnButton
              variant={'outlined'}
              loading={busy}
              disabled={busy || loading}
              onClick={() => void runAction(() => loadModels(provider))}
            >
              {provider === 'openrouter' ? '모델 목록 새로고침' : '다시 확인'}
            </DnButton>
          </>
        )}
      </div>
    </SettingsSection>
  );
};
export default AiSetting;
