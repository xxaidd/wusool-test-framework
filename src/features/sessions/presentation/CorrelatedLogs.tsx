"use client";

import { ScrollText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BackendLogEntry } from "@/features/sessions/application/BackendLogRepository";
import type { SessionEvent } from "@/features/sessions/domain/session.types";
import { createBackendLogRepository } from "@/features/sessions/infrastructure/backendLogRepository";
import { Badge } from "@/shared/components/Badge";
import { Button } from "@/shared/components/Button";
import { Spinner } from "@/shared/components/Spinner";
import { useI18n } from "@/shared/i18n";
import { redact, redactStringifiedBody } from "@/shared/redaction/redact";
import { useEnvironmentStore } from "@/shared/store/environment.store";

type LogsMode =
  | "idle"
  | "loading"
  | "success"
  | "unavailable"
  | "permission"
  | "error";

const WINDOW_MS = 60_000;

/** Defensive redaction of untrusted backend log content before rendering. */
function safeMessage(message: string): string {
  return redactStringifiedBody(message);
}

function safeMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  return metadata != null
    ? (redact(metadata) as Record<string, unknown>)
    : undefined;
}

/**
 * Lazy correlated backend-log panel for a single event. Logs are fetched only
 * when the user asks for them (no timeline-wide prefetch), the window is
 * derived from the event timestamp, and the request is aborted on unmount.
 */
export function CorrelatedLogs({ event }: { event: SessionEvent }) {
  const { t } = useI18n();
  const env = useEnvironmentStore((s) => s.env);
  const repo = useMemo(() => createBackendLogRepository(env), [env]);

  const [mode, setMode] = useState<LogsMode>("idle");
  const [entries, setEntries] = useState<BackendLogEntry[]>([]);
  const [message, setMessage] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const load = async () => {
    if (!event.correlationId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setMode("loading");
    setMessage("");
    try {
      const ts = Date.parse(event.ts);
      const anchor = Number.isFinite(ts) ? ts : Date.now();
      const result = await repo.fetchForCorrelation({
        envId: env.id,
        correlationId: event.correlationId,
        since: new Date(anchor - WINDOW_MS).toISOString(),
        until: new Date(anchor + WINDOW_MS).toISOString(),
        limit: 200,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      switch (result.status) {
        case "success":
          setEntries(result.entries);
          setMode("success");
          break;
        case "unavailable":
          setMode("unavailable");
          break;
        case "permission":
          setMode("permission");
          break;
        case "error":
          setMessage(result.message);
          setMode("error");
          break;
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setMessage(
        err instanceof Error ? err.message : "Failed to load backend logs.",
      );
      setMode("error");
    }
  };

  return (
    <div
      className="rounded-xl border border-border bg-surface-variant/60 p-3"
      aria-live="polite"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <ScrollText size={14} />
          {t("session.backendLogs")}
        </span>
        {mode === "idle" && (
          <Button
            variant="subtle"
            size="sm"
            onClick={load}
            disabled={!event.correlationId}
          >
            {t("session.loadLogs")}
          </Button>
        )}
      </div>

      {mode === "idle" && !event.correlationId && (
        <p className="text-xs text-ink-soft">
          {t("session.logsNoCorrelation")}
        </p>
      )}

      {mode === "loading" && (
        <output
          aria-busy="true"
          className="flex items-center gap-2 text-xs text-ink-soft"
        >
          <Spinner /> {t("session.logsLoading")}
        </output>
      )}

      {mode === "unavailable" && (
        <p className="text-xs font-medium text-warning">
          {t("session.logsUnavailable")}
        </p>
      )}

      {mode === "permission" && (
        <p className="text-xs font-medium text-danger">
          {t("session.logsPermission")}
        </p>
      )}

      {mode === "error" && (
        <div className="text-xs text-danger">
          <p className="font-medium">{t("session.logsError")}</p>
          {message && (
            <p className="mt-1 break-all font-mono text-ink-soft">{message}</p>
          )}
        </div>
      )}

      {mode === "success" && entries.length === 0 && (
        <p className="text-xs text-ink-soft">{t("session.logsEmpty")}</p>
      )}

      {mode === "success" && entries.length > 0 && (
        <ul className="max-h-56 space-y-2 overflow-y-auto">
          {entries.map((entry, index) => {
            const metadata = safeMetadata(entry.metadata);
            return (
              <li
                key={`${entry.ts}-${index}`}
                className="rounded-lg border border-border bg-surface p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-ink-faint">
                    {entry.ts}
                  </span>
                  <Badge
                    tone={
                      entry.level === "error"
                        ? "danger"
                        : entry.level === "warn" || entry.level === "warning"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {entry.level}
                  </Badge>
                </div>
                <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px] text-ink">
                  {safeMessage(entry.message)}
                </pre>
                {metadata != null && Object.keys(metadata).length > 0 && (
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-surface-variant p-1.5 font-mono text-[10px] text-ink-soft">
                    {JSON.stringify(metadata, null, 2)}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
