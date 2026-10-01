import SettingsSection from '~/components/common/settings-section';
import { useEffect, useState } from 'react';

import { getSettingInfo, updateSelectedLLMModel } from '~/lib/electron/setting-api';
import { getOllamaModels, getOllamaRunning, type OllamaModel } from '~/lib/ollama-api';
import { DnSelect } from '~/components/common/selector';

function getModelName(model: OllamaModel) {
  return model.model || model.name;
}

function formatModelSize(size?: number) {
  if (!size) {
    return undefined;
  }

  const gib = size / 1024 / 1024 / 1024;
  return `${gib.toFixed(gib >= 10 ? 0 : 1)}GB`;
}

function toModelOption(model: OllamaModel) {
  const modelName = getModelName(model);
  const size = formatModelSize(model.size);

  return {
    description: [model.details?.parameter_size, model.details?.quantization_level, size]
      .filter(Boolean)
      .join(' · '),
    label: modelName,
    value: modelName,
  };
}

const AiSetting = () => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [llmModels, setLlmModels] = useState<OllamaModel[]>([]);
  const [selectedLLMModel, setSelectedLLMModel] = useState<string | null>(null);

  useEffect(() => {
    const loadModels = async () => {
      setIsLoading(true);

      const nextIsRunning = await getOllamaRunning();
      setIsRunning(nextIsRunning);

      if (!nextIsRunning) {
        setLlmModels([]);
        setSelectedLLMModel(null);
        return;
      }

      const [modelResponse, settingInfo] = await Promise.all([getOllamaModels(), getSettingInfo()]);
      const nextLlmModels = modelResponse.models.filter((model) =>
        model.capabilities.includes('completion'),
      );
      const nextLlmNames = new Set(nextLlmModels.map(getModelName));
      const nextSelectedLLMModel =
        settingInfo.selectedLLMModel && nextLlmNames.has(settingInfo.selectedLLMModel)
          ? settingInfo.selectedLLMModel
          : nextLlmModels[0]
            ? getModelName(nextLlmModels[0])
            : null;

      setLlmModels(nextLlmModels);
      setSelectedLLMModel(nextSelectedLLMModel);

      if (nextSelectedLLMModel !== settingInfo.selectedLLMModel) {
        await updateSelectedLLMModel(nextSelectedLLMModel);
      }
    };

    void loadModels()
      .catch(() => {
        setIsRunning(false);
        setLlmModels([]);
        setSelectedLLMModel(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleLLMModelChange = async (value: string | number) => {
    const nextValue = value ? String(value) : null;
    setSelectedLLMModel(nextValue);
    await updateSelectedLLMModel(nextValue);
  };

  return (
    <SettingsSection
      collapsible
      title={'AI 모델 설정'}
      description={'댓글 생성, 회차 정보 요약에 사용할 LLM 모델을 선택합니다.'}
    >
      <div>
        {!isRunning && (
          <div className='mb-3'>
            <div className='font-medium text-neutral-900'>Ollama를 찾을 수 없습니다.</div>
            <p className='mt-1'>
              로컬 AI 기능을 사용하려면 Ollama를 설치한 뒤 앱을 다시 실행해주세요.
            </p>
            <a
              className='mt-3 inline-flex font-medium text-blue-600 hover:text-blue-700'
              href='https://ollama.com/download'
              rel='noreferrer'
              target='_blank'
            >
              Ollama 다운로드
            </a>
          </div>
        )}

        {isRunning && (
          <div className='space-y-4'>
            {isLoading && <div className='py-1'>모델 목록을 불러오는 중입니다.</div>}

            {!isLoading && llmModels.length === 0 && (
              <div className='py-1'>모델을 찾을 수 없습니다. Ollama에서 모델을 설치해주세요.</div>
            )}

            <DnSelect
              disabled={llmModels.length === 0}
              emptyLabel='사용 가능한 LLM 모델 없음'
              hint='요약, 생성, 대화형 작업에 사용할 모델입니다.'
              label='LLM 모델'
              onChange={(value) => void handleLLMModelChange(value)}
              options={llmModels.map(toModelOption)}
              value={selectedLLMModel ?? ''}
            />
          </div>
        )}

        <div className='mt-4'>
          <div className='font-medium text-neutral-900'>추천 모델</div>
          <ul className='mt-2 space-y-1'>
            <li>
              LLM:{' '}
              <a
                className='font-medium text-blue-600 hover:text-blue-700'
                href='https://ollama.com/ingu627/exaone4.0'
                rel='noreferrer'
                target='_blank'
              >
                EXAONE 4.0
              </a>{' '}
              <span className='text-neutral-400'>(커뮤니티 빌드, 라이선스 확인 필요)</span>
            </li>
          </ul>
        </div>
      </div>
    </SettingsSection>
  );
};

export default AiSetting;
