"use client";

import {
  CircleStop,
  Download,
  FolderOpen,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import type { ImportedSession } from "@/features/sessions/application/sessionImporter";
import {
  checkImportSize,
  importSessionFile,
} from "@/features/sessions/application/sessionImporter";
import type { SessionEvent } from "@/features/sessions/domain/session.types";
import { Badge } from "@/shared/components/Badge";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { SessionImportError } from "@/shared/errors";
import { useI18n } from "@/shared/i18n";
import { useSessionStore } from "@/shared/store/session.store";
import { EventInspector } from "./EventInspector";
import { SessionTimeline } from "./SessionTimeline";
import { SessionViewer } from "./SessionViewer";

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
  const [viewer, setViewer] = useState<ImportedSession | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onStart = () => {
    start(name.trim() || undefined);
    setName("");
  };

  const onPickFile = async (file: File | undefined) => {
    setImportError(null);
    if (!file) return;
    try {
      checkImportSize(file.size);
      const imported = importSessionFile(await file.text());
      setViewer(imported);
    } catch (err) {
      if (err instanceof SessionImportError) {
        setImportError(err.message);
      } else {
        setImportError(t("session.importInvalid"));
      }
    }
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
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            title={t("session.open")}
          >
            <FolderOpen size={16} />
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

      <input
        ref={fileInputRef}
        type="file"
        accept=".wusool-session,application/json"
        className="hidden"
        onChange={(e) => {
          void onPickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

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

      {importError && (
        <div
          role="alert"
          className="mx-4 mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-medium text-danger"
        >
          {t("session.importError")}: {importError}
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

      <div className="min-h-0 flex-1">
        <SessionTimeline events={events} onSelect={setDetail} />
      </div>

      <EventInspector event={detail} onClose={() => setDetail(null)} />

      <SessionViewer session={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
