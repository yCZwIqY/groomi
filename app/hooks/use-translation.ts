import { useCallback } from 'react';
import { translate, type TranslationKey } from '~/lib/translations';
import { useLanguage } from '~/stores/use-language';

export function useTranslation() {
  const language = useLanguage((state) => state.language);
  const t = useCallback((key: TranslationKey): string => translate(language, key), [language]);
  return {
    language,
    locale: language === 'en' ? 'en-US' : 'ko-KR',
    t,
  };
}
