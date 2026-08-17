"use client";

import { create } from "zustand";
import { exportSession as exportSessionUsecase } from "@/features/sessions/application/exportSession";
import type {
  SessionEvent,
  SessionSource,
} from "@/features/sessions/domain/session.types";
import { browserSessionDownloader } from "@/features/sessions/infrastructure/sessionDownloader";

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
  request?: SessionEvent["request"];
  response?: SessionEvent["response"];
  error?: string;
  position?: SessionEvent["position"];
}

interface SessionState {
  recording: boolean;
  paused: boolean;
  startedAt?: string;
  events: SessionEvent[];
  start: () => void;
  pause: () => void;
  resume: () => void;
  clear: () => void;
  addEvent: (e: NewEvent) => void;
  exportSession: () => void;
}

let counter = 0;

export const useSessionStore = create<SessionState>((set, get) => ({
  recording: false,
  paused: false,
  startedAt: undefined,
  events: [],

  start: () =>
    set((s) => ({
      recording: true,
      paused: false,
      startedAt: s.startedAt ?? new Date().toISOString(),
    })),

  pause: () => set({ paused: true }),
  resume: () => set({ paused: false }),
  clear: () => set({ events: [], startedAt: undefined }),

  addEvent: (e) => {
    const s = get();
    if (!s.recording || s.paused) return;
    const event: SessionEvent = {
      ...e,
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
