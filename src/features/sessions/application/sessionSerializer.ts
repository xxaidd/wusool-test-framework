import type { BackendLogEntry } from "./BackendLogRepository";
import { buildStaticPaths, type StaticPath } from "./sessionPaths";
import type { SessionEvent } from "../domain/session.types";

export const SESSION_FORMAT_VERSION = 1;

export interface ExportedSession {
  app: string;
  formatVersion: number;
  exportedAt: string;
  sessionId?: string;
  name?: string;
  startedAt?: string;
  environment?: { id: string; label?: string };
  eventCount: number;
  events: SessionEvent[];
  /** Static historical movement paths derived from position events (FR-48). */
  paths: StaticPath[];
  /** Redacted correlated backend-log excerpts keyed by event id. */
  logs: Array<{ eventId: string; entries: BackendLogEntry[] }>;
}

/**
 * Serialize a session into the versioned export format (evidence, not
 * executable). Always includes static movement paths and redacted log
 * excerpts so reopened sessions can be inspected offline.
 */
export function serializeSession(input: {
  events: SessionEvent[];
  startedAt?: string;
  sessionId?: string;
  name?: string;
  environment?: { id: string; label?: string };
  logs?: Array<{ eventId: string; entries: BackendLogEntry[] }>;
}): ExportedSession {
  return {
    app: "Wusool Testing Framework",
    formatVersion: SESSION_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    ...(input.sessionId != null ? { sessionId: input.sessionId } : {}),
    ...(input.name != null ? { name: input.name } : {}),
    ...(input.startedAt != null ? { startedAt: input.startedAt } : {}),
    ...(input.environment != null
      ? { environment: input.environment }
      : {}),
    eventCount: input.events.length,
    events: input.events,
    paths: buildStaticPaths(input.events),
    logs: input.logs ?? [],
  };
}