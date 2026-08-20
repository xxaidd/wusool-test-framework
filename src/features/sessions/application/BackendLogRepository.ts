export interface BackendLogEntry {
  ts: string;
  level: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface BackendLogQuery {
  envId: string;
  correlationId: string;
  /** Bounded window start (ISO). Always clamped server-side. */
  since?: string;
  /** Bounded window end (ISO). Always clamped server-side. */
  until?: string;
  /** Maximum number of entries; clamped to a server-side cap. */
  limit?: number;
  signal?: AbortSignal;
}

export type LogFetchResult =
  | { status: "success"; entries: BackendLogEntry[] }
  | { status: "unavailable" }
  | { status: "permission" }
  | { status: "error"; message: string };

/**
 * Retrieves correlated backend logs for investigation. No backend log API is
 * documented yet (flagged unavailable in Task 0.2); the port is declared now
 * and implemented once an authorized log endpoint is contracted.
 */
export interface BackendLogRepository {
  fetchForCorrelation(input: BackendLogQuery): Promise<LogFetchResult>;
}
