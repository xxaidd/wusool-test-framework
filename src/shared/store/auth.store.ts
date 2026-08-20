"use client";

import { create } from "zustand";

/**
 * Client-side authentication display state. Tokens never reach the browser;
 * they live in the server-side vault keyed by `(actorId, environmentId)`.
 * This store only mirrors which actors have authenticated (and their email
 * for display) so the UI can badge them correctly.
 *
 * Deliberately NOT persisted: the vault is in-memory and empty after a reload,
 * so persisting flags would show a stale "Authenticated" badge while the first
 * action would still prompt (the same reasoning as `adminConfigured`).
 */
interface AuthState {
  authenticated: Record<string, boolean>;
  emails: Record<string, string>;
  setAuthenticated: (actorId: string, email?: string) => void;
  clear: (actorId: string) => void;
  clearAll: () => void;
  isAuthenticated: (actorId: string) => boolean;
  getEmail: (actorId: string) => string | undefined;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  authenticated: {},
  emails: {},

  setAuthenticated: (actorId, email) =>
    set((s) => ({
      authenticated: { ...s.authenticated, [actorId]: true },
      emails: email ? { ...s.emails, [actorId]: email } : s.emails,
    })),

  clear: (actorId) =>
    set((s) => {
      const authenticated = { ...s.authenticated };
      const emails = { ...s.emails };
      delete authenticated[actorId];
      delete emails[actorId];
      return { authenticated, emails };
    }),

  clearAll: () => set({ authenticated: {}, emails: {} }),

  isAuthenticated: (actorId) => get().authenticated[actorId] === true,

  getEmail: (actorId) => get().emails[actorId],
}));
