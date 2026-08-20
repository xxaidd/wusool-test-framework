import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BffError, bffRequest, envRef } from "@/infrastructure/bff/client";
import type {
  BackendLogEntry,
  BackendLogQuery,
  BackendLogRepository,
  LogFetchResult,
} from "../application/BackendLogRepository";

interface LogsEnvelope {
  entries: BackendLogEntry[];
}

/**
 * Browser {@link BackendLogRepository} backed by the BFF. The environment is
 * sent as a safe reference; the BFF resolves it server-side and returns
 * sanitized, window-bounded entries. Distinct states are mapped so the UI can
 * render unavailable/permission/error surfaces explicitly.
 */
export function createBackendLogRepository(
  env: BackendEnvironment,
): BackendLogRepository {
  return {
    async fetchForCorrelation(input: BackendLogQuery): Promise<LogFetchResult> {
      try {
        const data = await bffRequest<LogsEnvelope>(
          "/api/wusool/logs",
          {
            env: envRef(env),
            correlationId: input.correlationId,
            since: input.since,
            until: input.until,
            limit: input.limit,
          },
          { signal: input.signal },
        );
        return { status: "success", entries: data.entries };
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        if (err instanceof BffError && err.code === "LOG_API_UNAVAILABLE") {
          return { status: "unavailable" };
        }
        if (
          err instanceof BffError &&
          (err.status === 401 || err.status === 403)
        ) {
          return { status: "permission" };
        }
        return {
          status: "error",
          message:
            err instanceof Error ? err.message : "Failed to load backend logs.",
        };
      }
    },
  };
}
