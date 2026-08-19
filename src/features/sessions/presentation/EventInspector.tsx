"use client";

import type { ReactNode } from "react";
import { Badge } from "@/shared/components/Badge";
import { Modal } from "@/shared/components/Modal";
import type { FailureClassification } from "@/shared/errors";
import { useI18n } from "@/shared/i18n";
import type { SessionEvent } from "../domain/session.types";
import { CorrelatedLogs } from "./CorrelatedLogs";

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour12: false });
}

const SUBTYPE_KEY: Record<string, string> = {
  timeout: "session.classificationSubtypeTimeout",
  network: "session.classificationSubtypeNetwork",
  "backend-unavailable": "session.classificationSubtypeBackendUnavailable",
  cancelled: "session.classificationSubtypeCancelled",
  storage: "session.classificationSubtypeStorage",
};

function classificationKeys(classification?: FailureClassification): string[] {
  if (!classification) return [];
  switch (classification.kind) {
    case "success":
      return ["session.classificationSuccess"];
    case "business":
      return ["session.classificationBusiness"];
    case "authorization":
      return ["session.classificationAuthorization"];
    case "validation":
      return ["session.classificationValidation"];
    case "infrastructure": {
      const key = SUBTYPE_KEY[classification.subtype];
      return ["session.classificationInfrastructure", key].filter(
        (k): k is string => typeof k === "string",
      );
    }
  }
}

function classificationTone(
  classification?: FailureClassification,
): "success" | "danger" | "warning" | "info" | "neutral" {
  if (!classification) return "neutral";
  switch (classification.kind) {
    case "success":
      return "success";
    case "business":
      return "danger";
    case "authorization":
      return "warning";
    case "validation":
      return "warning";
    case "infrastructure":
      return "info";
  }
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
      <span className="w-28 shrink-0 text-ink-soft">{label}</span>
      <span className="min-w-0 flex-1 break-all font-mono text-ink">
        {children}
      </span>
    </div>
  );
}

function Headers({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  if (entries.length === 0) {
    return <p className="text-xs text-ink-faint">—</p>;
  }
  return (
    <div className="space-y-1">
      {entries.map(([name, value]) => (
        <div key={name} className="flex flex-wrap gap-x-2 text-[11px]">
          <span className="w-28 shrink-0 break-all text-ink-soft">{name}:</span>
          <span className="min-w-0 flex-1 break-all font-mono text-ink">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function EventInspector({
  event,
  onClose,
}: {
  event: SessionEvent | null;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <Modal
      open={!!event}
      title={t("session.eventDetail")}
      onClose={onClose}
      width="max-w-3xl"
    >
      {event && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                event.status === "success"
                  ? "success"
                  : event.status === "failed"
                    ? "danger"
                    : "info"
              }
            >
              {event.status}
            </Badge>
            {classificationKeys(event.classification).map((key) => (
              <Badge key={key} tone={classificationTone(event.classification)}>
                {t(key)}
              </Badge>
            ))}
            <span className="text-xs text-ink-soft">
              {fmtTime(event.ts)}
              {event.durationMs != null ? ` · ${event.durationMs}ms` : ""}
            </span>
          </div>

          <div className="rounded-xl border border-border bg-surface-variant/60 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {t("session.metadata")}
            </div>
            <div className="space-y-1.5">
              <MetaRow label={t("session.actor")}>
                {event.actorLabel}
                {event.actorType ? ` (${event.actorType})` : ""}
              </MetaRow>
              <MetaRow label={t("session.actorId")}>{event.actorId}</MetaRow>
              <MetaRow label={t("session.action")}>{event.actionLabel}</MetaRow>
              <MetaRow label={t("session.actionId")}>{event.actionId}</MetaRow>
              <MetaRow label={t("session.category")}>
                {event.categoryId}
              </MetaRow>
            </div>
          </div>

          {event.error && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
              <span className="font-semibold">{t("session.error")}: </span>
              <span className="break-all font-mono">{event.error}</span>
            </div>
          )}

          {event.request && (
            <div className="rounded-xl border border-border bg-surface-variant/60 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  {t("session.request")}
                </span>
                <Badge tone="primary">{event.request.method}</Badge>
                <span className="min-w-0 break-all font-mono text-xs text-ink">
                  {event.request.url}
                </span>
              </div>
              <div className="mb-1 text-[11px] font-medium text-ink-soft">
                {t("session.headers")}
              </div>
              <Headers headers={event.request.headers} />
              {event.request.body && (
                <>
                  <div className="mb-1 mt-2 text-[11px] font-medium text-ink-soft">
                    {t("session.body")}
                  </div>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-surface p-2 font-mono text-xs text-ink">
                    {event.request.body}
                  </pre>
                </>
              )}
            </div>
          )}

          {event.response && (
            <div className="rounded-xl border border-border bg-surface-variant/60 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  {t("session.response")}
                </span>
                <Badge
                  tone={event.response.status < 400 ? "success" : "danger"}
                >
                  {event.response.status}
                </Badge>
              </div>
              <div className="mb-1 text-[11px] font-medium text-ink-soft">
                {t("session.headers")}
              </div>
              <Headers headers={event.response.headers} />
              {event.response.body && (
                <>
                  <div className="mb-1 mt-2 text-[11px] font-medium text-ink-soft">
                    {t("session.body")}
                  </div>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-surface p-2 font-mono text-xs text-ink">
                    {event.response.body}
                  </pre>
                </>
              )}
            </div>
          )}

          {(event.requestId ||
            event.executionId ||
            event.correlationId ||
            event.traceId) && (
            <div className="rounded-xl border border-border bg-surface-variant/60 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                {t("session.correlation")}
              </div>
              <div className="space-y-1.5">
                {event.requestId && (
                  <MetaRow label={t("session.requestId")}>
                    {event.requestId}
                  </MetaRow>
                )}
                {event.executionId && (
                  <MetaRow label={t("session.executionId")}>
                    {event.executionId}
                  </MetaRow>
                )}
                {event.correlationId && (
                  <MetaRow label={t("session.correlationId")}>
                    {event.correlationId}
                  </MetaRow>
                )}
                {event.traceId && (
                  <MetaRow label={t("session.traceId")}>
                    {event.traceId}
                  </MetaRow>
                )}
              </div>
            </div>
          )}

          <CorrelatedLogs event={event} />
        </div>
      )}
    </Modal>
  );
}
