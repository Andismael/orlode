/**
 * Language store — i18n with full translations
 * 6 languages, 300+ keys, persists to localStorage
 */
import { create } from 'zustand';
import fr from '@/i18n/fr';
import en from '@/i18n/en';
import es from '@/i18n/es';
import ar from '@/i18n/ar';
import de from '@/i18n/de';
import pt from '@/i18n/pt';

export type LangCode = 'fr' | 'en' | 'es' | 'ar' | 'de' | 'pt';

export const LANGUAGES: Array<{ code: LangCode; label: string; flag: string }> = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
];

const TRANSLATIONS: Record<LangCode, Record<string, string>> = {
  fr: fr as unknown as Record<string, string>,
  en: en as unknown as Record<string, string>,
  es: es as unknown as Record<string, string>,
  ar: ar as unknown as Record<string, string>,
  de: de as unknown as Record<string, string>,
  pt: pt as unknown as Record<string, string>,
};

interface LangState {
  lang: LangCode;
  setLang: (lang: LangCode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const useLangStore = create<LangState>((set, get) => {
  // Read new key first, fall back to old key (migration), then browser lang
  const stored = (localStorage.getItem('orlode-lang') ?? localStorage.getItem('corpmind-lang')) as LangCode | null;
  const browserLang = (navigator.language || 'en').split('-')[0] as LangCode;
  const supported = ['fr', 'en', 'es', 'ar', 'de', 'pt'];
  // Default to English for international audience if browser lang is not supported
  const initial: LangCode = stored ?? (supported.includes(browserLang) ? browserLang : 'en');

  // Apply initial lang
  document.documentElement.lang = initial;
  if (initial === 'ar') document.documentElement.dir = 'rtl';

  return {
    lang: initial,
    setLang: (lang: LangCode) => {
      localStorage.setItem('orlode-lang', lang);
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      set({ lang });
    },
    t: (key: string, params?: Record<string, string | number>) => {
      const { lang } = get();
      let text = TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS['en']?.[key] ?? TRANSLATIONS['fr']?.[key] ?? key;
      // Replace {n}, {name} etc.
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, String(v));
        });
      }
      return text;
    },
  };
});
