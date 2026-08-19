"use client";

import {
  CircleStop,
  Clapperboard,
  Download,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type { SessionEvent } from "@/features/sessions/domain/session.types";
import { SessionSource } from "@/features/sessions/domain/session.types";
import { Badge } from "@/shared/components/Badge";
import { Button } from "@/shared/components/Button";
import { EmptyState } from "@/shared/components/EmptyState";
import { Input } from "@/shared/components/Input";
import { Modal } from "@/shared/components/Modal";
import { useI18n } from "@/shared/i18n";
import { useSessionStore } from "@/shared/store/session.store";

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour12: false });
}

function sourceTone(s: SessionSource) {
  return s === SessionSource.Manual
    ? "primary"
    : s === SessionSource.Workflow
      ? "info"
      : "neutral";
}

export function SessionPanel() {
  const { t } = useI18n();
  const recording = useSessionStore((s) => s.recording);
  const paused = useSessionStore((s) => s.paused);
  const events = useSessionStore((s) => s.events);
  const storageError = useSessionStore((s) => s.storageError);
  const start = useSessionStore((s) => s.start);
  const pause = useSessionStore((s) => s.pause);
  const resume = useSessionStore((s) => s.resume);
  const end = useSessionStore((s) => s.end);
  const clear = useSessionStore((s) => s.clear);
  const exportSession = useSessionStore((s) => s.exportSession);
  const [detail, setDetail] = useState<SessionEvent | null>(null);
  const [name, setName] = useState("");

  const onStart = () => {
    start(name.trim() || undefined);
    setName("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-ink">{t("session.title")}</h2>
          <Badge tone={recording ? (paused ? "warning" : "danger") : "neutral"}>
            {recording
              ? paused
                ? t("session.paused")
                : t("session.recording")
              : t("session.live")}
          </Badge>
          <span className="text-xs text-ink-soft">{events.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {!recording ? (
            <Button size="sm" onClick={onStart}>
              <Play size={16} />
              {t("session.start")}
            </Button>
          ) : (
            <>
              <Button
                variant="subtle"
                size="sm"
                onClick={paused ? resume : pause}
                title={paused ? t("session.resume") : t("session.pause")}
              >
                {paused ? <Play size={16} /> : <Pause size={16} />}
              </Button>
              <Button
                variant="subtle"
                size="sm"
                onClick={end}
                title={t("session.end")}
              >
                <CircleStop size={16} />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={events.length === 0}
            title={t("common.clear")}
          >
            <Trash2 size={16} />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={exportSession}
            disabled={events.length === 0}
          >
            <Download size={16} />
            {t("session.export")}
          </Button>
        </div>
      </div>

      {!recording && (
        <div className="border-b border-border px-4 py-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("session.namePlaceholder")}
            aria-label={t("session.name")}
            onKeyDown={(e) => {
              if (e.key === "Enter") onStart();
            }}
          />
        </div>
      )}

      {storageError && (
        <div
          role="alert"
          className="mx-4 mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-medium text-danger"
        >
          {t(storageError)}
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {events.length === 0 && (
          <EmptyState
            icon={Clapperboard}
            title={t("session.empty")}
            hint={t("session.start")}
          />
        )}
        <ol className="relative border-s border-border ps-4 pe-3 py-3">
          {events.map((e) => (
            <li key={e.id} className="mb-3">
              <button
                type="button"
                onClick={() => setDetail(e)}
                className="block w-full rounded-lg border border-border bg-surface p-2.5 text-start transition-colors hover:border-primary"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-ink-faint">
                    {fmtTime(e.ts)}
                  </span>
                  <Badge tone={sourceTone(e.source)}>
                    {t(`session.source${e.source}`)}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      e.status === "success"
                        ? "bg-success"
                        : e.status === "failed"
                          ? "bg-danger"
                          : "bg-info"
                    }`}
                  />
                  <span className="truncate text-xs font-medium text-ink">
                    {e.actorLabel} · {e.summary}
                  </span>
                </div>
                {e.statusCode ? (
                  <div className="mt-1 font-mono text-[11px] text-ink-soft">
                    {e.request?.method} {e.statusCode}
                  </div>
                ) : null}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <Modal
        open={!!detail}
        title={t("session.eventDetail")}
        onClose={() => setDetail(null)}
        width="max-w-2xl"
      >
        {detail && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge
                tone={
                  detail.status === "success"
                    ? "success"
                    : detail.status === "failed"
                      ? "danger"
                      : "info"
                }
              >
                {detail.status}
              </Badge>
              <span className="text-ink-soft">
                {fmtTime(detail.ts)} · {detail.durationMs}ms
              </span>
            </div>
            <div className="text-ink">
              <span className="font-semibold">{detail.actorLabel}</span> ·{" "}
              {detail.summary}
            </div>
            {detail.error && <div className="text-danger">{detail.error}</div>}

            {detail.request && (
              <div className="rounded-xl border border-border bg-surface-variant/60 p-3 font-mono text-xs">
                <div className="mb-1 flex items-center gap-2 text-ink">
                  <Badge tone="primary">{detail.request.method}</Badge>
                  <span className="break-all">{detail.request.url}</span>
                </div>
                {detail.request.body && (
                  <pre className="whitespace-pre-wrap break-all text-ink">
                    {detail.request.body}
                  </pre>
                )}
              </div>
            )}

            {detail.response && (
              <div className="rounded-xl border border-border bg-surface-variant/60 p-3 font-mono text-xs">
                <div className="mb-1 text-ink">
                  {t("action.status")}:{" "}
                  <Badge
                    tone={detail.response.status < 400 ? "success" : "danger"}
                  >
                    {detail.response.status}
                  </Badge>
                </div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-ink">
                  {detail.response.body}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
