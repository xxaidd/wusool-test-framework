import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";

const LOCAL_URL =
  process.env.NEXT_PUBLIC_WUSOOL_LOCAL_URL ?? "http://localhost:5002";
const DEV_URL =
  process.env.NEXT_PUBLIC_WUSOOL_DEV_URL ?? "https://api-dev.wusool.to/";
const STAGING_URL =
  process.env.NEXT_PUBLIC_WUSOOL_STAGING_URL ?? "https://api-dev.wusool.to/";

export const DEFAULT_ENV: BackendEnvironment = {
  id: BackendEnvId.Local,
  label: "Local",
  baseUrl: LOCAL_URL,
};

export const envPresets: BackendEnvironment[] = [
  DEFAULT_ENV,
  {
    id: BackendEnvId.Development,
    label: "Development",
    baseUrl: DEV_URL,
  },
  {
    id: BackendEnvId.Staging,
    label: "Staging",
    baseUrl: STAGING_URL,
  },
];
