"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { bffRequest, envRef } from "@/infrastructure/bff/client";
import { DEFAULT_ENV } from "@/infrastructure/configuration/environments";

export interface HealthState {
  ok: boolean;
  status: number;
  checking: boolean;
}

interface EnvironmentState {
  env: BackendEnvironment;
  /**
   * Whether the admin/session-manager auth is configured for the current
   * environment. The actual tokens live in the server-side vault; this flag
   * only drives UI hints and must reset on reload (server vault is empty).
   */
  adminConfigured: boolean;
  health: HealthState;
  setEnv: (env: BackendEnvironment) => void;
  setAdminConfigured: (configured: boolean) => void;
  checkHealth: () => Promise<HealthState>;
}

export const useEnvironmentStore = create<EnvironmentState>()(
  persist(
    (set, get) => ({
      env: DEFAULT_ENV,
      adminConfigured: false,
      health: { ok: false, status: 0, checking: false },

      setEnv: (env) => {
        set({ env, health: { ok: false, status: 0, checking: false } });
        get().checkHealth();
      },

      setAdminConfigured: (adminConfigured) => set({ adminConfigured }),

      checkHealth: async () => {
        set({ health: { ...get().health, checking: true } });
        try {
          const result = await bffRequest<{ ok: boolean; status: number }>(
            "/api/wusool/health",
            { env: envRef(get().env) },
          );
          const health: HealthState = {
            ok: result.ok,
            status: result.status,
            checking: false,
          };
          set({ health });
          return health;
        } catch {
          const health: HealthState = {
            ok: false,
            status: 0,
            checking: false,
          };
          set({ health });
          return health;
        }
      },
    }),
    {
      name: "wusool-environment",
      storage: createJSONStorage(() => sessionStorage),
      // Only the environment is persisted. Admin configuration is a sensitive,
      // in-memory-only flag: the server-side vault is empty after a reload, so
      // the flag must never survive in browser storage (Task 1.3 decision).
      partialize: (s) => ({ env: s.env }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<EnvironmentState>),
        adminConfigured: false,
      }),
    },
  ),
);
