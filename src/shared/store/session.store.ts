"use client";

import { create } from "zustand";
import { exportSession as exportSessionUsecase } from "@/features/sessions/application/exportSession";
import { createSessionEvent } from "@/features/sessions/application/sessionEventFactory";
import type { SessionEvent } from "@/features/sessions/domain/session.types";
import { SessionSource } from "@/features/sessions/domain/session.types";
import { browserSessionDownloader } from "@/features/sessions/infrastructure/sessionDownloader";

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
  appendEvent: (ev: SessionEvent) => void;
  setEnvId: (envId: string) => void;
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
      startedAt: undefined,
      recording: false,
      paused: false,
      envId: newEnvId,
    });
  },

  appendEvent: (ev) => {
    const s = get();
    if (!s.recording || s.paused) return;
    set((st) => ({ events: [...st.events, ev] }));
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
