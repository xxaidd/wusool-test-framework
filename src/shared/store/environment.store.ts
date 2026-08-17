"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { DEFAULT_ENV } from "@/infrastructure/configuration/environments";
import { checkHealth } from "@/infrastructure/http/health";

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
        const result = await checkHealth(get().env.baseUrl);
        const health: HealthState = {
          ok: result.ok,
          status: result.status,
          checking: false,
        };
        set({ health });
        return health;
      },
    }),
    {
      name: "wusool-environment",
      partialize: (s) => ({ env: s.env, adminToken: s.adminToken }),
    },
  ),
);
