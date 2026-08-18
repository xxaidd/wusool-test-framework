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
  adminToken: string;
  health: HealthState;
  setEnv: (env: BackendEnvironment) => void;
  setAdminToken: (token: string) => void;
  checkHealth: () => Promise<HealthState>;
}

export const useEnvironmentStore = create<EnvironmentState>()(
  persist(
    (set, get) => ({
      env: DEFAULT_ENV,
      adminToken: "",
      health: { ok: false, status: 0, checking: false },

      setEnv: (env) => {
        set({ env, health: { ok: false, status: 0, checking: false } });
        get().checkHealth();
      },

      setAdminToken: (adminToken) => set({ adminToken }),

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
      partialize: (s) => ({ env: s.env, adminToken: s.adminToken }),
    },
  ),
);
