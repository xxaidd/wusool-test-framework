import { SessionStorageError } from "@/shared/errors";
import type {
  SessionStorage,
  SessionSummary,
  StoredSession,
} from "../application/SessionStorage";

const DB_NAME = "wusool-sessions";
const DB_VERSION = 1;
const STORE_NAME = "sessions";
const ACTIVE_SESSION_KEY = "wusool-active-session";

export interface ActiveSessionRef {
  sessionId: string;
  environmentId: string;
  name?: string;
  startedAt?: string;
}

function indexedDbUnavailable(): boolean {
  return typeof indexedDB === "undefined";
}

/**
 * Open the session database, creating the object store on first use. Handles
 * the edge case of a pre-existing database at the current version that lacks
 * the store (e.g. created by an earlier iteration) by reopening at the next
 * version, and normalizes synchronous `indexedDB.open` throws (such as
 * `SecurityError` when storage is blocked) into a structured error.
 */
function openDb(): Promise<IDBDatabase> {
  if (indexedDbUnavailable()) {
    return Promise.reject(
      new SessionStorageError(
        "Local session storage (IndexedDB) is unavailable in this browser.",
      ),
    );
  }
  return new Promise((resolve, reject) => {
    const request = openRequest(DB_VERSION);
    if (!request) {
      reject(
        new SessionStorageError(
          "Local session storage (IndexedDB) is blocked in this browser.",
        ),
      );
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "sessionId" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(STORE_NAME)) {
        resolve(db);
        return;
      }
      // A database existed at this version without the store; reopen at the
      // next version so `onupgradeneeded` runs and creates it.
      db.close();
      const upgrade = openRequest(DB_VERSION + 1);
      if (!upgrade) {
        reject(
          new SessionStorageError(
            "Local session storage (IndexedDB) is blocked in this browser.",
          ),
        );
        return;
      }
      upgrade.onupgradeneeded = () => {
        const upDb = upgrade.result;
        if (!upDb.objectStoreNames.contains(STORE_NAME)) {
          upDb.createObjectStore(STORE_NAME, { keyPath: "sessionId" });
        }
      };
      upgrade.onsuccess = () => resolve(upgrade.result);
      upgrade.onerror = () =>
        reject(
          new SessionStorageError("Could not open local session storage.", {
            cause: upgrade.error,
          }),
        );
      upgrade.onblocked = () =>
        reject(
          new SessionStorageError(
            "Local session storage is blocked by another tab.",
          ),
        );
    };
    request.onerror = () =>
      reject(
        new SessionStorageError("Could not open local session storage.", {
          cause: request.error,
        }),
      );
    request.onblocked = () =>
      reject(
        new SessionStorageError(
          "Local session storage is blocked by another tab.",
        ),
      );
  });
}

function openRequest(version: number): IDBOpenDBRequest | null {
  try {
    return indexedDB.open(DB_NAME, version);
  } catch {
    return null;
  }
}

function runStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let tx: IDBTransaction;
        try {
          tx = db.transaction(STORE_NAME, mode);
        } catch (err) {
          db.close();
          reject(
            new SessionStorageError("Local session storage is unavailable.", {
              cause: err,
            }),
          );
          return;
        }
        const store = tx.objectStore(STORE_NAME);
        let request: IDBRequest<T>;
        try {
          request = action(store);
        } catch (err) {
          db.close();
          reject(
            new SessionStorageError("Local session storage operation failed.", {
              cause: err,
            }),
          );
          return;
        }
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(
            new SessionStorageError("Local session storage operation failed.", {
              cause: request.error,
            }),
          );
        tx.oncomplete = () => db.close();
        tx.onabort = () => {
          db.close();
          reject(
            new SessionStorageError(
              "Local session storage transaction was aborted.",
              { cause: tx.error },
            ),
          );
        };
        tx.onerror = () => {
          db.close();
          reject(
            new SessionStorageError(
              "Local session storage transaction failed.",
              {
                cause: tx.error,
              },
            ),
          );
        };
      }),
  );
}

function getActiveStorage(): Storage | null {
  const global = globalThis as { sessionStorage?: Storage };
  if (global.sessionStorage != null) return global.sessionStorage;
  return null;
}

export function getActiveSessionRef(): ActiveSessionRef | null {
  const storage = getActiveStorage();
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ActiveSessionRef;
    if (typeof parsed.sessionId !== "string" || !parsed.sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setActiveSessionRef(ref: ActiveSessionRef): void {
  const storage = getActiveStorage();
  if (!storage) return;
  try {
    storage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(ref));
  } catch {
    // The pointer is a convenience for auto-resume; a blocked sessionStorage
    // must not surface a storage error or interrupt a successful write.
  }
}

export function clearActiveSessionRef(): void {
  const storage = getActiveStorage();
  if (!storage) return;
  try {
    storage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // Best-effort cleanup; the in-memory reset must not be blocked.
  }
}

/**
 * Concrete {@link SessionStorage} backed by IndexedDB. Persists only sanitized
 * evidence (already redacted by the recorder) and degrades to a visible,
 * structured {@link SessionStorageError} when IndexedDB is unavailable
 * (private mode, SSR, or non-supporting browsers) — callers surface it rather
 * than silently dropping evidence.
 */
export const indexedDbSessionStorage: SessionStorage = {
  async save(session: StoredSession): Promise<void> {
    await runStore("readwrite", (store) => store.put(session));
  },

  async load(sessionId: string): Promise<StoredSession | null> {
    const record = await runStore<StoredSession | undefined>(
      "readonly",
      (store) => store.get(sessionId),
    );
    return record ?? null;
  },

  async list(): Promise<SessionSummary[]> {
    const records = await runStore<StoredSession[]>("readonly", (store) =>
      store.getAll(),
    );
    return records.map((r) => ({
      sessionId: r.sessionId,
      environmentId: r.environmentId,
      ...(r.startedAt != null ? { startedAt: r.startedAt } : {}),
      eventCount: r.events.length,
    }));
  },

  async delete(sessionId: string): Promise<void> {
    await runStore("readwrite", (store) => store.delete(sessionId));
  },
};
