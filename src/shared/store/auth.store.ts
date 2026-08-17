"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  /** actorId -> JWT access token acquired via JIT authentication */
  tokens: Record<string, string>;
  /** actorId -> email used to authenticate (for display) */
  emails: Record<string, string>;
  setToken: (actorId: string, token: string, email?: string) => void;
  clearToken: (actorId: string) => void;
  clearAll: () => void;
  getToken: (actorId: string) => string | undefined;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      tokens: {},
      emails: {},

      setToken: (actorId, token, email) =>
        set((s) => ({
          tokens: { ...s.tokens, [actorId]: token },
          emails: email ? { ...s.emails, [actorId]: email } : s.emails,
        })),

      clearToken: (actorId) =>
        set((s) => {
          const tokens = { ...s.tokens };
          const emails = { ...s.emails };
          delete tokens[actorId];
          delete emails[actorId];
          return { tokens, emails };
        }),

      clearAll: () => set({ tokens: {}, emails: {} }),

      getToken: (actorId) => get().tokens[actorId],
    }),
    {
      name: "wusool-auth",
      partialize: (s) => ({ tokens: s.tokens, emails: s.emails }),
    },
  ),
);
