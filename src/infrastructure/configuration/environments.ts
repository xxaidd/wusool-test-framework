import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";

export const DEFAULT_ENV: BackendEnvironment = {
  id: BackendEnvId.Local,
  label: "Local",
  baseUrl: "http://localhost:5002",
};

export const envPresets: BackendEnvironment[] = [
  DEFAULT_ENV,
  {
    id: BackendEnvId.Development,
    label: "Development",
    baseUrl: "http://localhost:5002",
  },
  {
    id: BackendEnvId.Staging,
    label: "Staging",
    baseUrl: "http://localhost:5002",
  },
];
