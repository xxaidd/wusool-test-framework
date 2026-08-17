import type { FailureClassification } from "@/shared/errors";
import type { CorrelationInfo } from "@/shared/lib/correlation";
import type {
  SanitizedRequest,
  SanitizedResponse,
} from "@/shared/redaction/redact";

export type {
  CorrelationInfo,
  FailureClassification,
  SanitizedRequest,
  SanitizedResponse,
};

/**
 * Normalized, evidence-ready record of one executed operation. Sanitized
 * request/response are only producible through the shared redaction module,
 * so secrets cannot enter persisted evidence. Consumed by the
 * `SessionRecorder` port.
 */
export interface ExecutionRecord {
  requestId: string;
  executionId: string;
  environmentId: string;
  actorId: string;
  actionId: string;
  startedAt: string;
  durationMs: number;
  request: SanitizedRequest;
  response?: SanitizedResponse;
  correlation?: CorrelationInfo;
  classification: FailureClassification;
}
