import type { SessionEvent } from "../domain/session.types";

export interface StoredSession {
  sessionId: string;
  environmentId: string;
  formatVersion: number;
  startedAt?: string;
  events: SessionEvent[];
}

export interface SessionSummary {
  sessionId: string;
  environmentId: string;
  startedAt?: string;
  eventCount: number;
}

/**
 * Persists sanitized active sessions behind a storage abstraction
 * (IndexedDB browser implementation arrives in Phase 3).
 */
export interface SessionStorage {
  save(session: StoredSession): Promise<void>;
  load(sessionId: string): Promise<StoredSession | null>;
  list(): Promise<SessionSummary[]>;
  delete(sessionId: string): Promise<void>;
}
