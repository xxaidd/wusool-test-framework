"use client";

import { createSessionEvent } from "@/features/sessions/application/sessionEventFactory";
import { toStoredSession } from "@/features/sessions/application/sessionPersistence";
import { SessionSource } from "@/features/sessions/domain/session.types";
import {
  clearActiveSessionRef,
  indexedDbSessionStorage,
  setActiveSessionRef,
} from "@/features/sessions/infrastructure/indexedDbSessionStorage";
import { useSessionStore } from "@/shared/store/session.store";

/** Trailing debounce that coalesces bursts of events into one write. */
export const SAVE_DEBOUNCE_MS = 400;

let timer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;

/** Serializes all writes so lifecycle transitions and flushes cannot interleave. */
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(op: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(op, op);
  writeQueue = next.catch(() => undefined);
  return next;
}

/**
 * Schedule a batched write of the active session. While a storage failure is
 * active this becomes a no-op: events keep accumulating in memory so evidence
 * and exports are never silently dropped, but no further failing writes are
 * attempted (the failure event is recorded only once).
 */
export function scheduleSave(): void {
  if (useSessionStore.getState().storageError != null) return;
  dirty = true;
  if (timer != null) return;
  timer = setTimeout(() => {
    timer = null;
    if (!dirty) return;
    dirty = false;
    void flush();
  }, SAVE_DEBOUNCE_MS);
}

export function cancelPendingSave(): void {
  if (timer != null) {
    clearTimeout(timer);
    timer = null;
  }
  dirty = false;
}

interface FlushOptions {
  /** When true, keep writing even if the session is no longer active (end/switch retention). */
  retain?: boolean;
  /** When true, update the active-session pointer after a successful write. */
  setPointer?: boolean;
}

/**
 * Persist the current in-memory session to IndexedDB. By default the
 * active-session pointer is updated only while the session is still recording,
 * so an ended/cleared/switched session can never auto-resume after a reload.
 * On failure the storage error is surfaced on the store and a single system
 * event is recorded; callers never observe an unhandled rejection.
 */
export async function flush(input?: FlushOptions): Promise<void> {
  cancelPendingSave();
  const state = useSessionStore.getState();
  if (!state.sessionId) return;

  const session = toStoredSession({
    sessionId: state.sessionId,
    environmentId: state.envId ?? "",
    startedAt: state.startedAt,
    name: state.name,
    events: state.events,
    updatedAt: new Date().toISOString(),
  });

  await enqueue(async () => {
    const current = useSessionStore.getState();
    const noLongerActive = current.sessionId !== session.sessionId;
    if (noLongerActive && input?.retain !== true) {
      // The session was cleared or switched while this write was queued; drop
      // the stale snapshot so a cleared session can never reappear.
      return;
    }
    const stillActive =
      current.sessionId === session.sessionId && current.recording;

    try {
      await indexedDbSessionStorage.save(session);
      if (stillActive && input?.setPointer !== false) {
        setActiveSessionRef({
          sessionId: session.sessionId,
          environmentId: session.environmentId,
          ...(session.name != null ? { name: session.name } : {}),
          ...(session.startedAt != null
            ? { startedAt: session.startedAt }
            : {}),
        });
      }
      useSessionStore.setState({ storageError: undefined });
    } catch (err) {
      // The stored value is an i18n key so the panel renders a translated,
      // visible notice (no raw internal messages) while the concrete error text
      // is preserved in the recorded system event.
      const message =
        err instanceof Error
          ? err.message
          : "Local session storage failed unexpectedly.";
      const store = useSessionStore.getState();
      const alreadyReported = store.storageError != null;
      useSessionStore.setState({ storageError: "session.storageError" });
      if (!alreadyReported) {
        store.appendEvent(
          createSessionEvent({
            source: SessionSource.System,
            actor: { id: "system", label: "System" },
            action: {
              id: "system.storage",
              label: "Session storage",
              categoryId: "system",
            },
            summary: "Local session storage failed",
            status: "info",
            error: message,
            classification: { kind: "infrastructure", subtype: "storage" },
          }),
        );
      }
    }
  });
}

/** Remove the persisted session record and its active pointer. */
export async function deletePersistedSession(sessionId: string): Promise<void> {
  cancelPendingSave();
  clearActiveSessionRef();
  await enqueue(async () => {
    try {
      await indexedDbSessionStorage.delete(sessionId);
    } catch {
      // Deletion is best-effort cleanup; the in-memory reset must not be blocked.
    }
  });
}
