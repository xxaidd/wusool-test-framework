"use client";

import type {
  RecordEventInput,
  SessionRecorder,
  SessionStart,
} from "@/features/sessions/application/SessionRecorder";
import { createSessionEvent } from "@/features/sessions/application/sessionEventFactory";
import { useSessionStore } from "@/shared/store/session.store";

/**
 * Concrete {@link SessionRecorder} backed by the in-memory session store. The
 * single application path for recording events: builds immutable sanitized
 * events through the factory and appends them to the active session. Owns no
 * secrets and never touches the network.
 */
export const sessionRecorder: SessionRecorder = {
  start(input: SessionStart) {
    const store = useSessionStore.getState();
    store.start();
    store.setEnvId(input.environmentId);
  },

  record(input: RecordEventInput) {
    const event = createSessionEvent({
      source: input.source,
      actor: input.actor ?? {
        id: "system",
        label: "System",
      },
      action: input.action ?? {
        id: "system",
        label: input.summary,
        categoryId: "system",
      },
      summary: input.summary,
      status: input.status === "failure" ? "failed" : input.status,
      ...(input.error != null ? { error: input.error } : {}),
      ...(input.position != null ? { position: input.position } : {}),
      ...(input.execution != null ? { execution: input.execution } : {}),
      ...(input.classification != null
        ? { classification: input.classification }
        : {}),
      ...(input.baseUrl != null ? { baseUrl: input.baseUrl } : {}),
    });
    useSessionStore.getState().appendEvent(event);
  },

  stop() {
    // End recording. Already-captured events remain immutable evidence.
    useSessionStore.setState({ recording: false });
  },
};
