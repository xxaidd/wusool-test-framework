import { SessionImportError } from "@/shared/errors";
import type { BackendLogEntry } from "./BackendLogRepository";
import { exportedSessionSchema } from "./exportedSession.schema";
import { migrateSessionFile } from "./sessionMigrations";
import type { StaticPath } from "./sessionPaths";
import type { SessionEvent } from "../domain/session.types";

/** Maximum accepted size for an imported `.wusool-session` file. */
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

export interface ImportedSession {
  sessionId?: string;
  name?: string;
  startedAt?: string;
  exportedAt?: string;
  environment?: { id: string; label?: string };
  events: SessionEvent[];
  paths: StaticPath[];
  logs: Array<{ eventId: string; entries: BackendLogEntry[] }>;
}

/**
 * Reject oversized session files before parsing so a malformed or hostile
 * file cannot exhaust memory. Pure and framework-free.
 */
export function checkImportSize(bytes: number): void {
  if (!Number.isFinite(bytes) || bytes > MAX_IMPORT_BYTES) {
    throw new SessionImportError(
      `The session file exceeds the ${MAX_IMPORT_BYTES} byte import limit.`,
    );
  }
}

function readVersion(raw: unknown): unknown {
  if (typeof raw !== "object" || raw == null) return undefined;
  return (raw as { formatVersion?: unknown }).formatVersion;
}

/**
 * Import a `.wusool-session` file as read-only evidence: size check → parse →
 * migrate known versions → validate against the load-boundary schema. Throws
 * {@link SessionImportError} with an actionable message on any failure. The
 * caller renders the result in a read-only viewer; this never issues backend
 * requests or mutates session/workflow state.
 */
export function importSessionFile(rawText: string): ImportedSession {
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    throw new SessionImportError(
      "The session file is not valid JSON.",
    );
  }

  const migrated = migrateSessionFile(readVersion(raw), raw);
  const parsed = exportedSessionSchema.safeParse(migrated);
  if (!parsed.success) {
    throw new SessionImportError(
      "The session file is malformed or missing required fields.",
      { cause: parsed.error },
    );
  }

  const data = parsed.data;
  return {
    ...(data.sessionId != null ? { sessionId: data.sessionId } : {}),
    ...(data.name != null ? { name: data.name } : {}),
    ...(data.startedAt != null ? { startedAt: data.startedAt } : {}),
    ...(data.exportedAt != null ? { exportedAt: data.exportedAt } : {}),
    ...(data.environment != null ? { environment: data.environment } : {}),
    events: data.events as SessionEvent[],
    paths: data.paths ?? [],
    logs: data.logs ?? [],
  };
}