"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ar } from "./ar";
import { en, type Messages } from "./en";

export type Locale = "en" | "ar";

export interface I18nApi {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Translate a dotted key, optionally interpolating `{var}` placeholders. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  messages: Messages;
  dir: "ltr" | "rtl";
}

const dicts: Record<Locale, Messages> = { en, ar };

const I18nContext = createContext<I18nApi | null>(null);

function path(locale: Messages, key: string): string | undefined {
  const parts = key.split(".");
  let cur: unknown = locale;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

function interp(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_m, k) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const t = useCallback<I18nApi["t"]>(
    (key, vars) => {
      const raw = path(dicts[locale], key);
      if (raw == null) return key;
      return interp(raw, vars);
    },
    [locale],
  );

  const value = useMemo<I18nApi>(
    () => ({
      locale,
      setLocale: (l) => setLocaleState(l),
      t,
      messages: dicts[locale],
      dir: locale === "ar" ? "rtl" : "ltr",
    }),
    [locale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nApi {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}
