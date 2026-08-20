import { z } from "zod";

/**
 * Load-boundary validation for a single backend-log entry embedded in an
 * exported session file. Mirrors the {@link BackendLogEntry} shape; metadata
 * is passthrough so unknown keys in the source log never fail an import.
 */
export const sessionLogSchema = z
  .object({
    ts: z.string(),
    level: z.string(),
    message: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type SessionLogData = z.infer<typeof sessionLogSchema>;
