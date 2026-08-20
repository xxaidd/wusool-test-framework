import { z } from "zod";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendUnavailableError } from "@/shared/errors";
import { redact, redactStringifiedBody } from "@/shared/redaction/redact";
import type {
  BackendLogEntry,
  BackendLogQuery,
  BackendLogRepository,
  LogFetchResult,
} from "../application/BackendLogRepository";

export const BACKEND_LOG_MAX_LIMIT = 500;
export const BACKEND_LOG_DEFAULT_LIMIT = 200;

export interface BackendLogFetcherInput {
  baseUrl: string;
  endpoint: string;
  correlationId: string;
  since?: string;
  until?: string;
  limit: number;
  signal?: AbortSignal;
}

export type BackendLogFetcher = (
  input: BackendLogFetcherInput,
) => Promise<unknown>;

/** Contract-gated server endpoint; unset means the log API is unavailable. */
export function getBackendLogEndpoint(): string | undefined {
  const endpoint = process.env.WUSOOL_BACKEND_LOG_ENDPOINT;
  return endpoint != null && endpoint.length > 0 ? endpoint : undefined;
}

const backendLogEntrySchema = z.object({
  ts: z.string().min(1),
  level: z.string(),
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

async function fetchBackendLogs(
  input: BackendLogFetcherInput,
): Promise<unknown> {
  const url = new URL(input.endpoint, input.baseUrl);
  url.searchParams.set("correlationId", input.correlationId);
  if (input.since != null) url.searchParams.set("since", input.since);
  if (input.until != null) url.searchParams.set("until", input.until);
  url.searchParams.set("limit", String(input.limit));
  const res = await fetch(url.toString(), { signal: input.signal });
  if (!res.ok) {
    throw new BackendUnavailableError(
      `Backend log request failed with status ${res.status}.`,
    );
  }
  return res.json();
}

/**
 * Server-side {@link BackendLogRepository}. No backend log endpoint is
 * contracted yet, so by default log retrieval is explicitly unavailable
 * (Task 0.2: no endpoint guessing). When `WUSOOL_BACKEND_LOG_ENDPOINT` is
 * configured, entries are fetched, validated, redacted, and limited to the
 * server-side cap before they can reach the browser.
 */
export function createServerBackendLogRepository(
  env: BackendEnvironment,
  opts: {
    endpoint?: string;
    fetcher?: BackendLogFetcher;
    maxLimit?: number;
  } = {},
): BackendLogRepository {
  const endpoint = opts.endpoint ?? getBackendLogEndpoint();
  const maxLimit = opts.maxLimit ?? BACKEND_LOG_MAX_LIMIT;
  const fetcher = opts.fetcher ?? fetchBackendLogs;

  return {
    async fetchForCorrelation(input: BackendLogQuery): Promise<LogFetchResult> {
      if (endpoint == null) {
        return { status: "unavailable" };
      }
      try {
        const raw = await fetcher({
          baseUrl: env.baseUrl,
          endpoint,
          correlationId: input.correlationId,
          since: input.since,
          until: input.until,
          limit: Math.min(input.limit ?? BACKEND_LOG_DEFAULT_LIMIT, maxLimit),
          signal: input.signal,
        });
        if (!Array.isArray(raw)) {
          return {
            status: "error",
            message: "Unexpected backend log payload.",
          };
        }
        const entries: BackendLogEntry[] = [];
        for (const item of raw) {
          const parsed = backendLogEntrySchema.safeParse(item);
          if (!parsed.success) continue;
          const { ts, level, message, metadata } = parsed.data;
          entries.push({
            ts,
            level,
            message: redactStringifiedBody(message),
            ...(metadata != null
              ? { metadata: redact(metadata) as Record<string, unknown> }
              : {}),
          });
        }
        return { status: "success", entries };
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") throw err;
        return {
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Backend log retrieval failed.",
        };
      }
    },
  };
}
