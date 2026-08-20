import { z } from "zod";
import { sessionLogSchema } from "./sessionLog.schema";
import { SESSION_FORMAT_VERSION } from "./sessionSerializer";
import { sessionEventSchema } from "./storedSession.schema";

const staticPathPointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

const staticPathSchema = z
  .object({
    actorId: z.string(),
    actorLabel: z.string(),
    points: z.array(staticPathPointSchema),
  })
  .passthrough();

const environmentSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().optional(),
  })
  .passthrough();

const correlatedLogsSchema = z
  .object({
    eventId: z.string(),
    entries: z.array(sessionLogSchema),
  })
  .passthrough();

/**
 * Load-boundary validation for imported `.wusool-session` files (Task 3.4).
 * Rejects unsupported future format versions (via the migration path) and
 * malformed/missing required fields before the read-only viewer trusts the
 * evidence. Unknown keys are tolerated so older/forward-compatible files
 * remain openable.
 */
export const exportedSessionSchema = z
  .object({
    app: z.string(),
    formatVersion: z.literal(SESSION_FORMAT_VERSION),
    exportedAt: z.string(),
    sessionId: z.string().optional(),
    name: z.string().optional(),
    startedAt: z.string().optional(),
    environment: environmentSchema.optional(),
    eventCount: z.number(),
    events: z.array(sessionEventSchema),
    paths: z.array(staticPathSchema).optional(),
    logs: z.array(correlatedLogsSchema).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.eventCount !== value.events.length) {
      ctx.addIssue({
        code: "custom",
        path: ["eventCount"],
        message: "eventCount does not match the number of events.",
      });
    }
  })
  .passthrough();

export type ExportedSessionData = z.infer<typeof exportedSessionSchema>;
