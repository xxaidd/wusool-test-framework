"use client";

import { Clapperboard, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { filterSessionEvents } from "@/features/sessions/application/timelineFilters";
import type { SessionEvent } from "@/features/sessions/domain/session.types";
import { SessionSource } from "@/features/sessions/domain/session.types";
import { Badge } from "@/shared/components/Badge";
import { EmptyState } from "@/shared/components/EmptyState";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { useI18n } from "@/shared/i18n";

const SOURCE_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: "all", labelKey: "session.sourceAll" },
  { value: SessionSource.Manual, labelKey: "session.sourceManual" },
  { value: SessionSource.Workflow, labelKey: "session.sourceWorkflow" },
  { value: SessionSource.System, labelKey: "session.sourceSystem" },
];

const STATUS_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: "all", labelKey: "session.statusAll" },
  { value: "success", labelKey: "session.statusSuccess" },
  { value: "failed", labelKey: "session.statusFailed" },
  { value: "info", labelKey: "session.statusInfo" },
];

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

export function SessionTimeline({
  events,
  onSelect,
}: {
  events: SessionEvent[];
  onSelect: (event: SessionEvent) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(
    () =>
      filterSessionEvents(events, {
        query: deferredQuery,
        source: source as "all" | SessionSource,
        status: status as "all" | SessionEvent["status"],
      }),
    [events, deferredQuery, source, status],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-border px-4 py-3">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("session.search")}
            aria-label={t("session.search")}
            className="ps-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            aria-label={t("session.filterSource")}
            options={SOURCE_OPTIONS.map((o) => ({
              value: o.value,
              label: t(o.labelKey),
            }))}
          />
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label={t("session.filterStatus")}
            options={STATUS_OPTIONS.map((o) => ({
              value: o.value,
              label: t(o.labelKey),
            }))}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Clapperboard}
            title={
              events.length === 0 ? t("session.empty") : t("session.noMatches")
            }
            hint={events.length === 0 ? t("session.start") : undefined}
          />
        ) : (
          <ol className="relative border-s border-border ps-4 pe-3 py-3">
            {filtered.map((e) => (
              <li key={e.id} className="mb-3">
                <button
                  type="button"
                  onClick={() => onSelect(e)}
                  className="block w-full rounded-lg border border-border bg-surface p-2.5 text-start transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
        )}
      </div>
    </div>
  );
}
