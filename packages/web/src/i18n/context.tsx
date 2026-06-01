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

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: Key, params?: Record<string, string | number>) => string;
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

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  return ctx.t;
}

export function useLocale() {
  const ctx = useContext(I18nContext);
  return { locale: ctx.locale, setLocale: ctx.setLocale };
}
