export interface BackendLogEntry {
  ts: string;
  level: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface BackendLogQuery {
  envId: string;
  correlationId: string;
  signal?: AbortSignal;
}

/**
 * Retrieves correlated backend logs for investigation. No backend log API is
 * documented yet (flagged unavailable in Task 0.2); the port is declared now
 * and implemented once an authorized log endpoint is contracted.
 */
export interface BackendLogRepository {
  fetchForCorrelation(input: BackendLogQuery): Promise<BackendLogEntry[]>;
}
