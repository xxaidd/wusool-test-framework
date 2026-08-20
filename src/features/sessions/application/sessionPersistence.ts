import { SessionStorageError } from "@/shared/errors";
import type { SessionEvent } from "../domain/session.types";
import type { StoredSession } from "./SessionStorage";
import { SESSION_FORMAT_VERSION } from "./sessionSerializer";
import { storedSessionSchema } from "./storedSession.schema";

export interface SessionSnapshot {
  sessionId?: string;
  environmentId?: string;
  startedAt?: string;
  name?: string;
  events: SessionEvent[];
  updatedAt?: string;
}

/**
 * Build a persisted {@link StoredSession} from a plain session snapshot. Pure
 * and framework-free; persists only sanitized evidence that already passed the
 * recorder's redaction boundary.
 */
export function toStoredSession(snapshot: SessionSnapshot): StoredSession {
  return {
    sessionId: snapshot.sessionId ?? "",
    environmentId: snapshot.environmentId ?? "",
    formatVersion: SESSION_FORMAT_VERSION,
    ...(snapshot.startedAt != null ? { startedAt: snapshot.startedAt } : {}),
    ...(snapshot.name != null ? { name: snapshot.name } : {}),
    ...(snapshot.updatedAt != null ? { updatedAt: snapshot.updatedAt } : {}),
    events: snapshot.events,
  };
}

/**
 * Validate raw persisted data and return a typed {@link StoredSession}.
 * Rejects malformed payloads and unsupported future format versions with an
 * actionable {@link SessionStorageError} so callers never trust unvalidated
 * storage content.
 */
export function loadSession(raw: unknown): StoredSession {
  const parsed = storedSessionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SessionStorageError(
      "The stored session is invalid or uses an unsupported format version.",
      { cause: parsed.error },
    );
  }
  return parsed.data as StoredSession;
}
