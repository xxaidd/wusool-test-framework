import { z } from "zod";
import { SESSION_FORMAT_VERSION } from "./sessionSerializer";

const statusSchema = z.enum(["success", "failed", "info"]);
const sourceSchema = z.enum(["manual", "workflow", "system"]);
const classificationSchema = z
  .object({
    kind: z.enum(["business", "infrastructure"]),
    subtype: z.string().optional(),
  })
  .passthrough();

const requestSchema = z
  .object({
    method: z.string(),
    url: z.string(),
    headers: z.record(z.string(), z.string()),
    body: z.string().optional(),
  })
  .passthrough();

const responseSchema = z
  .object({
    status: z.number(),
    headers: z.record(z.string(), z.string()),
    body: z.string(),
  })
  .passthrough();

const sessionEventSchema = z
  .object({
    id: z.string().min(1),
    ts: z.string().min(1),
    source: sourceSchema,
    actorId: z.string(),
    actorLabel: z.string(),
    actionId: z.string(),
    actionLabel: z.string(),
    categoryId: z.string(),
    summary: z.string(),
    status: statusSchema,
    durationMs: z.number().optional(),
    statusCode: z.number().optional(),
    error: z.string().optional(),
    position: z.object({ lat: z.number(), lng: z.number() }).optional(),
    seq: z.number().optional(),
    requestId: z.string().optional(),
    executionId: z.string().optional(),
    correlationId: z.string().optional(),
    traceId: z.string().optional(),
    classification: classificationSchema.optional(),
    request: requestSchema.optional(),
    response: responseSchema.optional(),
  })
  .passthrough();

/**
 * Load-boundary validation for persisted sessions. Validates data coming out
 * of local storage (and, in Task 3.4, imported session files) before the
 * application trusts it. Future format versions are rejected so callers can
 * show an actionable error rather than corrupting evidence.
 */
export const storedSessionSchema = z
  .object({
    sessionId: z.string().min(1),
    environmentId: z.string().min(1),
    formatVersion: z.literal(SESSION_FORMAT_VERSION),
    startedAt: z.string().optional(),
    name: z.string().optional(),
    updatedAt: z.string().optional(),
    events: z.array(sessionEventSchema),
  })
  .passthrough();

export type StoredSessionData = z.infer<typeof storedSessionSchema>;
