"use client";

import { Globe } from "lucide-react";
import type { Locale } from "@/shared/i18n";
import { useI18n } from "@/shared/i18n";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  const switchTo: Locale = locale === "en" ? "ar" : "en";

  return (
    <button
      type="button"
      onClick={() => setLocale(switchTo)}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary"
      title={`Switch to ${switchTo === "ar" ? "العربية" : "English"}`}
    >
      <Globe size={15} className="text-ink-soft" />
      <span className="font-semibold">{switchTo === "ar" ? "عربي" : "EN"}</span>
    </button>
  );
}
