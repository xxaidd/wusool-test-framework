import { SessionImportError } from "@/shared/errors";
import { SESSION_FORMAT_VERSION } from "./sessionSerializer";

/**
 * Registry of known session-file migrations. An entry migrates a raw parsed
 * payload from `from` to `from + 1`. Version 1 is the first release format and
 * needs no migration; future versions add an entry here (with a test) rather
 * than duplicating migration logic in importers.
 */
export const SESSION_MIGRATIONS: ReadonlyArray<{
  from: number;
  migrate: (raw: unknown) => unknown;
}> = [];

/** The oldest format version this framework can open (before migration). */
export const MIN_SESSION_FORMAT_VERSION = 1;

/**
 * Migrate a raw parsed session file to the current {@link SESSION_FORMAT_VERSION}.
 * Throws an actionable {@link SessionImportError} naming the supported versions
 * when the file is newer than this framework can read.
 */
export function migrateSessionFile(version: unknown, raw: unknown): unknown {
  const numeric = typeof version === "number" ? version : Number.NaN;
  if (!Number.isInteger(numeric)) {
    throw new SessionImportError(
      "The session file is missing a valid format version.",
    );
  }
  if (numeric > SESSION_FORMAT_VERSION) {
    throw new SessionImportError(
      `The session file format version ${numeric} is not supported by this framework. Supported versions: ${MIN_SESSION_FORMAT_VERSION}-${SESSION_FORMAT_VERSION}.`,
    );
  }
  if (numeric < MIN_SESSION_FORMAT_VERSION) {
    throw new SessionImportError(
      `The session file format version ${numeric} is too old to open. Supported versions: ${MIN_SESSION_FORMAT_VERSION}-${SESSION_FORMAT_VERSION}.`,
    );
  }
  let current = raw;
  for (const migration of SESSION_MIGRATIONS) {
    if (migration.from >= numeric) {
      current = migration.migrate(current);
    }
  }
  return current;
}
