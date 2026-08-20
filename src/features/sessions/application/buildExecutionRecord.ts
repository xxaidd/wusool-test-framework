import type { FailureClassification } from "@/shared/errors";
import type { CorrelationInfo } from "@/shared/lib/correlation";
import { createId } from "@/shared/lib/ids";
import type {
  SanitizedRequest,
  SanitizedResponse,
} from "@/shared/redaction/redact";
import type { ExecutionRecord } from "../domain/evidence.types";

/** Shape of an executed operation outcome that can be turned into evidence. */
export interface ExecutionOutcome {
  ok: boolean;
  needsAuth: boolean;
  statusCode?: number;
  durationMs: number;
  correlation?: CorrelationInfo;
  request: SanitizedRequest;
  response?: SanitizedResponse;
  classification?: FailureClassification;
}

export interface BuildExecutionRecordInput {
  envId: string;
  actorId: string;
  actionId: string;
  startedAt: string;
  outcome: ExecutionOutcome;
  /** Injected id generator for deterministic tests. */
  createIdFn?: (prefix: string) => string;
}

/** Classify an outcome without a precomputed classification. */
export function classifyExecutionOutcome(
  outcome: ExecutionOutcome,
): FailureClassification {
  if (outcome.ok) return { kind: "success" };
  if (outcome.needsAuth) return { kind: "authorization", needsAuth: true };
  const status = outcome.statusCode ?? 0;
  if (status >= 400 && status < 500) return { kind: "business" };
  if (status >= 500)
    return { kind: "infrastructure", subtype: "backend-unavailable" };
  return { kind: "infrastructure", subtype: "network" };
}

/**
 * Build the evidence-ready {@link ExecutionRecord} for an executed operation.
 * Generates a unique `executionId`, reuses the framework correlation id as the
 * `requestId` when available (so the record joins to backend logs), and copies
 * only sanitized request/response evidence.
 */
export function buildExecutionRecord(
  input: BuildExecutionRecordInput,
): ExecutionRecord {
  const createIdFn = input.createIdFn ?? createId;
  const { outcome } = input;
  const requestId = outcome.correlation?.correlationId ?? createIdFn("req");
  return {
    requestId,
    executionId: createIdFn("exec"),
    environmentId: input.envId,
    actorId: input.actorId,
    actionId: input.actionId,
    startedAt: input.startedAt,
    durationMs: outcome.durationMs,
    request: outcome.request,
    ...(outcome.response != null ? { response: outcome.response } : {}),
    ...(outcome.correlation != null
      ? { correlation: outcome.correlation }
      : {}),
    classification: outcome.classification ?? classifyExecutionOutcome(outcome),
  };
}
