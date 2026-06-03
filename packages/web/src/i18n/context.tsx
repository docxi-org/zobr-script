import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import en from "./en";
import ru from "./ru";

export type Locale = "en" | "ru";
type Messages = typeof en;
type Key = keyof Messages;

const LOCALES: Record<Locale, Messages> = { en, ru: ru as unknown as Messages };

const STORAGE_KEY = "zs_locale";

function loadLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "en" || saved === "ru") return saved;
  const nav = navigator.language.slice(0, 2);
  return nav === "ru" ? "ru" : "en";
}

function pluralIndex(locale: Locale, n: number): number {
  if (locale === "ru") {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 0;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 1;
    return 2;
  }
  return n === 1 ? 0 : 1;
}

export type PluralForms = readonly string[];

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: Key, params?: Record<string, string | number>) => string;
  plural: (n: number, forms: PluralForms) => string;
}

const I18nContext = createContext<I18nContextValue>(null!);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(loadLocale);

  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLocaleState(l);
  }, []);

  const t = useCallback((key: Key, params?: Record<string, string | number>): string => {
    let msg: string = LOCALES[locale][key] ?? LOCALES["en"][key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        msg = msg.replace(`{${k}}`, String(v));
      }
    }
    return msg;
  }, [locale]);

  const plural = useCallback((n: number, forms: PluralForms): string => {
    return forms[pluralIndex(locale, n)] ?? forms[forms.length - 1] ?? "";
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, plural }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  return ctx.t;
}

export function usePlural() {
  const ctx = useContext(I18nContext);
  return ctx.plural;
}

export function useLocale() {
  const ctx = useContext(I18nContext);
  return { locale: ctx.locale, setLocale: ctx.setLocale };
}
