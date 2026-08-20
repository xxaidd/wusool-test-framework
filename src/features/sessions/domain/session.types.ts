import type { ActorType } from "@/features/actors/domain/actor.types";
import type { FailureClassification } from "@/shared/errors";

export enum SessionSource {
  Manual = "manual",
  Workflow = "workflow",
  System = "system",
}

export interface SessionRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface SessionResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface SessionEvent {
  id: string;
  ts: string;
  source: SessionSource;
  actorId: string;
  actorLabel: string;
  actorType?: ActorType;
  actionId: string;
  actionLabel: string;
  categoryId: string;
  summary: string;
  status: "success" | "failed" | "info";
  durationMs?: number;
  statusCode?: number;
  request?: SessionRequest;
  response?: SessionResponse;
  error?: string;
  position?: { lat: number; lng: number };
  /** Monotonic ordering sequence for chronological display under concurrent events. */
  seq?: number;
  /** Framework-side request id propagated to the backend (same as correlation id). */
  requestId?: string;
  /** Unique id of the executed operation this event records. */
  executionId?: string;
  correlationId?: string;
  traceId?: string;
  /** Distinguishes normal failed business actions from infrastructure failures. */
  classification?: FailureClassification;
}

export interface SessionState {
  recording: boolean;
  events: SessionEvent[];
  startedAt?: string;
  paused: boolean;
  /** Stable identity of the active session (generated on start). */
  sessionId?: string;
  /** Optional user-provided session name. */
  name?: string;
  /** Structured message of the last local-storage failure, surfaced to the UI. */
  storageError?: string;
}
