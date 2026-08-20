"use client";

import { create } from "zustand";
import { exportSession as exportSessionUsecase } from "@/features/sessions/application/exportSession";
import type { SessionEvent } from "@/features/sessions/domain/session.types";
import { SessionSource } from "@/features/sessions/domain/session.types";
import { browserSessionDownloader } from "@/features/sessions/infrastructure/sessionDownloader";
import {
  redactHeaders,
  redactStringifiedBody,
} from "@/shared/redaction/redact";

export interface NewEvent {
  source: SessionSource;
  actorId: string;
  actorLabel: string;
  actorType?: SessionEvent["actorType"];
  actionId: string;
  actionLabel: string;
  categoryId: string;
  summary: string;
  status: SessionEvent["status"];
  durationMs?: number;
  statusCode?: number;
  executionId?: string;
  request?: SessionEvent["request"];
  response?: SessionEvent["response"];
  error?: string;
  position?: SessionEvent["position"];
}

interface SessionState {
  recording: boolean;
  paused: boolean;
  startedAt?: string;
  /** Environment id this session's events belong to (environment isolation). */
  envId?: string;
  events: SessionEvent[];
  start: () => void;
  pause: () => void;
  resume: () => void;
  clear: () => void;
  addEvent: (e: NewEvent) => void;
  setEnvId: (envId: string) => void;
  finalizeForEnvironmentSwitch: (input: {
    oldLabel: string;
    newLabel: string;
    newEnvId: string;
    eventLabel: string;
  }) => void;
  exportSession: () => void;
}

let counter = 0;

export const useSessionStore = create<SessionState>((set, get) => ({
  recording: false,
  paused: false,
  startedAt: undefined,
  envId: undefined,
  events: [],

  start: () =>
    set((s) => ({
      recording: true,
      paused: false,
      startedAt: s.startedAt ?? new Date().toISOString(),
    })),

  pause: () => set({ paused: true }),
  resume: () => set({ paused: false }),
  clear: () => set({ events: [], startedAt: undefined, envId: undefined }),

  setEnvId: (envId) => set({ envId }),

  finalizeForEnvironmentSwitch: ({
    oldLabel,
    newLabel,
    newEnvId,
    eventLabel,
  }) => {
    const now = new Date().toISOString();
    const switchEvent: SessionEvent = {
      id: `ev_${Date.now()}_${++counter}`,
      ts: now,
      source: SessionSource.System,
      actorId: "system",
      actorLabel: "System",
      actionId: "environment.switch",
      actionLabel: eventLabel,
      categoryId: "environment",
      summary: `${oldLabel} → ${newLabel}`,
      status: "info",
    };
    // Environment switches finalize the in-memory session: the switch event is
    // retained as a boundary marker and all prior events are reset so no event
    // is ever reused across environments (FR-36).
    set({
      events: [switchEvent],
      startedAt: undefined,
      recording: false,
      paused: false,
      envId: newEnvId,
    });
  },

  addEvent: (e) => {
    const s = get();
    if (!s.recording || s.paused) return;
    const event: SessionEvent = {
      ...e,
      request: e.request
        ? {
            method: e.request.method,
            url: e.request.url,
            headers: redactHeaders(e.request.headers),
            body:
              e.request.body != null
                ? redactStringifiedBody(e.request.body)
                : undefined,
          }
        : undefined,
      response: e.response
        ? {
            status: e.response.status,
            headers: redactHeaders(e.response.headers),
            body:
              e.response.body != null
                ? redactStringifiedBody(e.response.body)
                : "",
          }
        : undefined,
      error: e.error,
      id: `ev_${Date.now()}_${++counter}`,
      ts: new Date().toISOString(),
    };
    set((st) => ({ events: [...st.events, event] }));
  },

  exportSession: () => {
    const s = get();
    exportSessionUsecase({
      events: s.events,
      startedAt: s.startedAt,
      download: browserSessionDownloader,
    });
  },
}));
