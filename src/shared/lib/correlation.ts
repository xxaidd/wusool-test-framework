/**
 * Traceability metadata connecting a framework action to the backend request.
 * `correlationId` is the framework-generated request id propagated to the
 * backend; `traceId` is the backend's own trace identifier (e.g. from the
 * `ErrorResponse.traceId` field captured by Task 0.2).
 */
export interface CorrelationInfo {
  correlationId?: string;
  traceId?: string;
}
