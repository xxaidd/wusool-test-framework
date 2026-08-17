import type { SessionEvent } from "../domain/session.types";

export const SESSION_FORMAT_VERSION = 1;

export interface ExportedSession {
  app: string;
  formatVersion: number;
  exportedAt: string;
  startedAt?: string;
  eventCount: number;
  events: SessionEvent[];
}

/** Serialize a session into the versioned export format (evidence, not executable). */
export function serializeSession(input: {
  events: SessionEvent[];
  startedAt?: string;
}): ExportedSession {
  return {
    app: "Wusool Testing Framework",
    formatVersion: SESSION_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    startedAt: input.startedAt,
    eventCount: input.events.length,
    events: input.events,
  };
}
