"use client";

import { create } from "zustand";
import { exportSession as exportSessionUsecase } from "@/features/sessions/application/exportSession";
import { createSessionEvent } from "@/features/sessions/application/sessionEventFactory";
import type { SessionEvent } from "@/features/sessions/domain/session.types";
import { SessionSource } from "@/features/sessions/domain/session.types";
import { clearActiveSessionRef } from "@/features/sessions/infrastructure/indexedDbSessionStorage";
import { browserSessionDownloader } from "@/features/sessions/infrastructure/sessionDownloader";
import type { BackendLogEntry } from "@/features/sessions/application/BackendLogRepository";
import { createId } from "@/shared/lib/ids";
import { useEnvironmentStore } from "@/shared/store/environment.store";
import {
  deletePersistedSession,
  flush as flushSession,
  scheduleSave,
} from "@/shared/store/sessionPersistence";

interface SessionState {
  recording: boolean;
  paused: boolean;
  startedAt?: string;
  /** Environment id this session's events belong to (environment isolation). */
  envId?: string;
  events: SessionEvent[];
  /** Redacted backend-log excerpts per event id, cached for export/offline view. */
  logs: Record<string, BackendLogEntry[]>;
  /** Stable identity of the active session (generated on start). */
  sessionId?: string;
  /** Optional user-provided session name. */
  name?: string;
  /** Structured message of the last local-storage failure, surfaced to the UI. */
  storageError?: string;
  start: (name?: string) => void;
  pause: () => void;
  resume: () => void;
  /** End recording, persist the final record as evidence, and stop auto-resume. */
  end: () => void;
  clear: () => void;
  appendEvent: (ev: SessionEvent) => void;
  setEnvId: (envId: string) => void;
  setStorageError: (error?: string) => void;
  setLogs: (eventId: string, entries: BackendLogEntry[]) => void;
  /** Restore a previously persisted active session after a page reload. */
  restore: (input: {
    sessionId: string;
    envId: string;
    startedAt?: string;
    name?: string;
    events: SessionEvent[];
  }) => void;
  finalizeForEnvironmentSwitch: (input: {
    oldLabel: string;
    newLabel: string;
    newEnvId: string;
    eventLabel: string;
  }) => void;
  exportSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  recording: false,
  paused: false,
  startedAt: undefined,
  envId: undefined,
  events: [],
  logs: {},
  sessionId: undefined,
  name: undefined,
  storageError: undefined,

  start: (name) =>
    set({
      recording: true,
      paused: false,
      startedAt: new Date().toISOString(),
      sessionId: createId("ses"),
      name,
      storageError: undefined,
    }),

  pause: () => set({ paused: true }),
  resume: () => set({ paused: false }),

  end: () => {
    set({ recording: false, paused: false });
    void flushSession({ setPointer: false });
    clearActiveSessionRef();
  },

  clear: () => {
    const { sessionId } = get();
    if (sessionId != null) {
      void deletePersistedSession(sessionId);
    }
    set({
      events: [],
      logs: {},
      startedAt: undefined,
      envId: undefined,
      sessionId: undefined,
      name: undefined,
      recording: false,
      paused: false,
      storageError: undefined,
    });
  },

  setEnvId: (envId) => set({ envId }),
  setStorageError: (error) => set({ storageError: error }),
  setLogs: (eventId, entries) =>
    set((s) => ({ logs: { ...s.logs, [eventId]: entries } })),

  restore: ({ sessionId, envId, startedAt, name, events }) =>
    set({
      recording: true,
      paused: false,
      startedAt,
      envId,
      events,
      sessionId,
      name,
      storageError: undefined,
    }),

  finalizeForEnvironmentSwitch: ({
    oldLabel,
    newLabel,
    newEnvId,
    eventLabel,
  }) => {
    // Persist the prior environment's session as retained evidence before the
    // in-memory reset, and clear its active pointer so reload does not resume
    // it across environments (FR-36).
    const { sessionId } = get();
    if (sessionId != null) {
      void flushSession({ retain: true, setPointer: false });
      clearActiveSessionRef();
    }
    const switchEvent = createSessionEvent({
      source: SessionSource.System,
      actor: { id: "system", label: "System" },
      action: {
        id: "environment.switch",
        label: eventLabel,
        categoryId: "environment",
      },
      summary: `${oldLabel} → ${newLabel}`,
      status: "info",
    });
    // Environment switches finalize the in-memory session: the switch event is
    // retained as a boundary marker and all prior events are reset so no event
    // is ever reused across environments (FR-36).
    set({
      events: [switchEvent],
      logs: {},
      startedAt: undefined,
      recording: false,
      paused: false,
      envId: newEnvId,
      sessionId: undefined,
      name: undefined,
      storageError: undefined,
    });
  },

  appendEvent: (ev) => {
    const s = get();
    if (!s.recording || s.paused) return;
    set((st) => ({ events: [...st.events, ev] }));
    scheduleSave();
  },

  exportSession: () => {
    void flushSession();
    const s = get();
    const env = useEnvironmentStore.getState().env;
    exportSessionUsecase({
      events: s.events,
      startedAt: s.startedAt,
      sessionId: s.sessionId,
      name: s.name,
      environment: { id: env.id, label: env.label },
      logs: Object.entries(s.logs).map(([eventId, entries]) => ({
        eventId,
        entries,
      })),
      download: browserSessionDownloader,
    });
  },
}));
