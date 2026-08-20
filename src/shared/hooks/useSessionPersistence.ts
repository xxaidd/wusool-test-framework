"use client";

import { useEffect } from "react";
import { loadSession } from "@/features/sessions/application/sessionPersistence";
import {
  getActiveSessionRef,
  indexedDbSessionStorage,
} from "@/features/sessions/infrastructure/indexedDbSessionStorage";
import { useSessionStore } from "@/shared/store/session.store";
import { flush as flushSession } from "@/shared/store/sessionPersistence";

/**
 * Client-side session lifecycle hook: silently restores the previously active
 * session from local storage after a page reload (same tab) and performs a
 * best-effort flush when the page is hidden/unloaded. Storage or load failures
 * surface on the store as a visible, translated notice without dropping the
 * in-memory evidence.
 */
export function useSessionPersistence(): void {
  useEffect(() => {
    const ref = getActiveSessionRef();
    if (ref != null) {
      indexedDbSessionStorage
        .load(ref.sessionId)
        .then((stored) => {
          if (stored == null) return;
          const session = loadSession(stored);
          useSessionStore.getState().restore({
            sessionId: session.sessionId,
            envId: session.environmentId,
            startedAt: session.startedAt,
            name: session.name,
            events: session.events,
          });
        })
        .catch(() => {
          useSessionStore.getState().setStorageError("session.storageError");
        });
    }

    const onPageHide = () => {
      void flushSession();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);
}
