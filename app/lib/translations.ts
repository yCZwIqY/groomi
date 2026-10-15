import { ko, type TranslationKey, type TranslationTree } from '~/locales/ko';
import { en } from '~/locales/en';
import type { Language } from '~/stores/use-language';

export const translations: Record<Language, TranslationTree> = { ko, en };
export type { TranslationKey };
export function translate(language: Language, key: TranslationKey): string {
  let value: unknown = translations[language];
  for (const part of key.split('.')) value = (value as Record<string, unknown>)[part];
  return value as string;
}
