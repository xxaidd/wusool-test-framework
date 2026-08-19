import type { ActorType } from "@/features/actors/domain/actor.types";
import type { FailureClassification } from "@/shared/errors";
import { createId } from "@/shared/lib/ids";
import {
  redactHeaders,
  redactStringifiedBody,
} from "@/shared/redaction/redact";
import type { ExecutionRecord } from "../domain/evidence.types";
import type {
  SessionEvent,
  SessionRequest,
  SessionResponse,
  SessionSource,
} from "../domain/session.types";

let seq = 0;

export interface SessionEventInput {
  source: SessionSource;
  actor: { id: string; label: string; type?: ActorType };
  action: { id: string; label: string; categoryId: string };
  summary: string;
  status: SessionEvent["status"];
  error?: string;
  position?: { lat: number; lng: number };
  execution?: ExecutionRecord;
  classification?: FailureClassification;
  /** Backend base URL used to render request URLs from the active environment. */
  baseUrl?: string;
  /** Injected clock (ms epoch) for deterministic tests. */
  clock?: () => number;
  /** Injected id generator for deterministic tests. */
  createIdFn?: (prefix: string) => string;
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string>,
) {
  const qs =
    query != null && Object.keys(query).length
      ? `?${new URLSearchParams(query).toString()}`
      : "";
  return `${baseUrl}${path}${qs}`;
}

function toSessionRequest(
  baseUrl: string,
  req: ExecutionRecord["request"],
): SessionRequest {
  return {
    method: req.method,
    url: buildUrl(baseUrl, req.path, req.query),
    headers: redactHeaders(req.headers),
    ...(req.body != null ? { body: redactStringifiedBody(req.body) } : {}),
  };
}

function toSessionResponse(
  res: NonNullable<ExecutionRecord["response"]>,
): SessionResponse {
  return {
    status: res.statusCode,
    headers: redactHeaders(res.headers),
    body: redactStringifiedBody(res.body ?? ""),
  };
}

function freeze<T extends object>(value: T): T {
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    if (
      nested != null &&
      typeof nested === "object" &&
      !Array.isArray(nested)
    ) {
      Object.freeze(nested);
    }
  }
  return value;
}

/**
 * Build an immutable, sanitized {@link SessionEvent} from high-level recording
 * input. Pure and framework-free: ids come from {@link createId} (or an injected
 * generator), the timestamp from an injected clock, chronology from a monotonic
 * `seq`, and request/response are defensively redacted before they can reach
 * storage. Execution trace metadata is flattened from the optional
 * {@link ExecutionRecord}.
 */
export function createSessionEvent(input: SessionEventInput): SessionEvent {
  const now = input.clock ?? Date.now;
  const createIdFn = input.createIdFn ?? createId;
  const { execution } = input;

  const event: SessionEvent = {
    id: createIdFn("ev"),
    seq: ++seq,
    ts: new Date(now()).toISOString(),
    source: input.source,
    actorId: input.actor.id,
    actorLabel: input.actor.label,
    ...(input.actor.type != null ? { actorType: input.actor.type } : {}),
    actionId: input.action.id,
    actionLabel: input.action.label,
    categoryId: input.action.categoryId,
    summary: input.summary,
    status: input.status,
    ...(input.error != null ? { error: input.error } : {}),
    ...(input.position != null ? { position: input.position } : {}),
    ...(input.classification != null
      ? { classification: input.classification }
      : {}),
    ...(execution != null
      ? {
          durationMs: execution.durationMs,
          requestId: execution.requestId,
          executionId: execution.executionId,
          ...(execution.correlation?.correlationId != null
            ? { correlationId: execution.correlation.correlationId }
            : {}),
          ...(execution.correlation?.traceId != null
            ? { traceId: execution.correlation.traceId }
            : {}),
          ...(execution.classification != null
            ? { classification: execution.classification }
            : {}),
          request: toSessionRequest(input.baseUrl ?? "", execution.request),
          ...(execution.response != null
            ? {
                response: toSessionResponse(execution.response),
                statusCode: execution.response.statusCode,
              }
            : {}),
        }
      : {}),
  };

  return freeze(event);
}
