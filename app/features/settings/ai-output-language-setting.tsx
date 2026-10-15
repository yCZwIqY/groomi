import { useEffect, useState } from 'react';
import { useTranslation } from '~/hooks/use-translation';
import { getSettingInfo, updateOutputLanguage } from '~/lib/electron/setting-api';

export default function AiOutputLanguageSetting() {
  const { t } = useTranslation();
  const [language, setLanguage] = useState<'auto' | 'ko' | 'en'>('auto');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void getSettingInfo()
      .then((setting) => {
        if (active) setLanguage(setting.aiOutputLanguage ?? 'auto');
      })
      .catch(() => {
        if (active) setError(t('ai.outputLanguage.loadError'));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [t]);
  return (
    <div>
      <label
        htmlFor='ai-output-language'
        className='font-medium text-stone-900'
      >
        {t('ai.outputLanguage.title')}
      </label>
      <p className='mb-3 mt-1 text-sm text-stone-500'>{t('ai.outputLanguage.description')}</p>
      <select
        id='ai-output-language'
        aria-label={t('ai.outputLanguage.title')}
        value={language}
        disabled={busy}
        className='rounded-lg border border-stone-200 bg-white px-3 py-2'
        onChange={(event) => {
          const value = event.target.value;
          if (value !== 'auto' && value !== 'ko' && value !== 'en') return;
          setBusy(true);
          setError('');
          void updateOutputLanguage(value)
            .then((setting) => setLanguage(setting.aiOutputLanguage ?? 'auto'))
            .catch(() => setError(t('ai.outputLanguage.saveError')))
            .finally(() => setBusy(false));
        }}
      >
        <option value='auto'>{t('ai.outputLanguage.auto')}</option>
        <option value='ko'>한국어</option>
        <option value='en'>English</option>
      </select>
      <p className='mt-3 text-sm text-stone-500'>{t('ai.outputLanguage.groupNote')}</p>
      {error && (
        <p
          role='alert'
          className='mt-2 text-sm text-red-600'
        >
          {error}
        </p>
      )}
    </div>
  );
}
