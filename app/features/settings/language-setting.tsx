import { useTranslation } from '~/hooks/use-translation';
import { useLanguage } from '~/stores/use-language';

export default function LanguageSetting() {
  const { t, language } = useTranslation();
  const setLanguage = useLanguage((state) => state.setLanguage);
  return (
    <div>
      <label
        htmlFor='display-language'
        className='font-medium text-stone-900'
      >
        {t('settings.displayLanguage')}
      </label>
      <p className='mb-3 mt-1 text-sm text-stone-500'>{t('settings.languageDescription')}</p>
      <select
        id='display-language'
        aria-label={t('settings.language')}
        value={language}
        onChange={(event) => setLanguage(event.target.value === 'en' ? 'en' : 'ko')}
        className='rounded-lg border border-stone-200 bg-white px-3 py-2'
      >
        <option value='ko'>한국어</option>
        <option value='en'>English</option>
      </select>
    </div>
  );
}
