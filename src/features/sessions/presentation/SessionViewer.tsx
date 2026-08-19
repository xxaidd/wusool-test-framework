"use client";

import { useState } from "react";
import type { ImportedSession } from "@/features/sessions/application/sessionImporter";
import type { SessionEvent } from "@/features/sessions/domain/session.types";
import { Badge } from "@/shared/components/Badge";
import { Modal } from "@/shared/components/Modal";
import { useI18n } from "@/shared/i18n";
import { EventInspector } from "./EventInspector";
import { SessionTimeline } from "./SessionTimeline";

function MetaRow({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
      <span className="w-24 shrink-0 text-ink-soft">{label}</span>
      <span className="min-w-0 flex-1 break-all font-mono text-ink">
        {children}
      </span>
    </div>
  );
}

/**
 * Read-only viewer for an imported `.wusool-session` file (Task 3.4). Renders
 * session metadata, the reusable timeline, and the technical inspector with
 * the file's embedded (cached) log excerpts. Never issues a backend request
 * and never mutates the active session or workflow stores.
 */
export function SessionViewer({
  session,
  onClose,
}: {
  session: ImportedSession | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [detail, setDetail] = useState<SessionEvent | null>(null);

  const logs = Object.fromEntries(
    session?.logs.map((entry) => [entry.eventId, entry.entries]) ?? [],
  );

  return (
    <>
      <Modal
        open={session != null}
        title={t("session.viewerTitle")}
        onClose={onClose}
        width="max-w-4xl"
      >
        {session && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="primary">{t("session.readOnly")}</Badge>
              <span className="text-xs text-ink-soft">
                {session.events.length} {t("session.eventCountLabel")}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-surface-variant/60 p-3">
              <div className="space-y-1.5">
                {session.name && (
                  <MetaRow label={t("session.name")}>{session.name}</MetaRow>
                )}
                {session.sessionId && (
                  <MetaRow label={t("session.id")}>{session.sessionId}</MetaRow>
                )}
                {session.environment && (
                  <MetaRow label={t("session.environment")}>
                    {session.environment.label ?? session.environment.id}
                  </MetaRow>
                )}
                {session.startedAt && (
                  <MetaRow label={t("session.startedAt")}>
                    {session.startedAt}
                  </MetaRow>
                )}
                {session.exportedAt && (
                  <MetaRow label={t("session.exportedAt")}>
                    {session.exportedAt}
                  </MetaRow>
                )}
              </div>
            </div>

            <div className="h-96 rounded-xl border border-border bg-surface-variant/40 p-2">
              <SessionTimeline
                events={session.events}
                onSelect={setDetail}
              />
            </div>
          </div>
        )}
      </Modal>

      <EventInspector
        event={detail}
        onClose={() => setDetail(null)}
        readOnly
        logs={logs}
      />
    </>
  );
}