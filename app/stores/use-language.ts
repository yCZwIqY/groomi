import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'ko' | 'en';

export const useLanguage = create<{
  language: Language;
  setLanguage: (language: Language) => void;
}>()(
  persist(
    (set) => ({
      language: 'ko',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'groomi-language',
      version: 1,
      partialize: (state) => ({ language: state.language }),
      merge: (persisted, current) => {
        const saved = persisted as { language?: unknown } | undefined;
        return { ...current, language: saved?.language === 'en' ? 'en' : 'ko' };
      },
    },
  ),
);
