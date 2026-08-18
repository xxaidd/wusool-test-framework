"use client";

import { useShallow } from "zustand/react/shallow";
import { Badge } from "@/shared/components/Badge";
import { Button } from "@/shared/components/Button";
import { LanguageSwitcher } from "@/shared/components/LanguageSwitcher";
import { ThemeToggle } from "@/shared/components/ThemeToggle";
import { useI18n } from "@/shared/i18n";
import { useEnvironmentStore } from "@/shared/store/environment.store";
import { useSessionStore } from "@/shared/store/session.store";
import { useUIStore } from "@/shared/store/ui.store";

export function TopBar({
  onOpenEnvironment,
}: {
  onOpenEnvironment: () => void;
}) {
  const { t } = useI18n();
  const env = useEnvironmentStore((s) => s.env);
  const health = useEnvironmentStore((s) => s.health);
  const session = useSessionStore(
    useShallow((s) => ({
      recording: s.recording,
      paused: s.paused,
      count: s.events.length,
      start: s.start,
      pause: s.pause,
      resume: s.resume,
      export: s.exportSession,
    })),
  );
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-lg text-on-primary glow-orange">
          🚌
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-ink">{t("app.name")}</div>
          <div className="hidden text-[11px] text-ink-soft sm:block">
            {t("app.tagline")}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      {/* Environment pill */}
      <button
        type="button"
        onClick={onOpenEnvironment}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-ink transition-colors hover:border-primary"
        title={t("nav.environment")}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            health.ok
              ? "bg-success"
              : health.checking
                ? "bg-warning"
                : "bg-danger"
          }`}
        />
        <span className="font-medium">{env.label}</span>
        <span className="text-ink-faint">▾</span>
      </button>

      {/* Session controls */}
      <div className="flex items-center gap-1">
        {session.recording ? (
          <>
            <Badge tone={session.paused ? "warning" : "danger"}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              {t("session.recording")}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={session.paused ? session.resume : session.pause}
            >
              {session.paused ? "▶" : "⏸"}
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={session.start}>
            {t("session.start")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={session.export}
          disabled={session.count === 0}
          title={t("session.export")}
        >
          ⬇ {t("session.export")}
        </Button>
      </div>

      <LanguageSwitcher />
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
    </header>
  );
}
