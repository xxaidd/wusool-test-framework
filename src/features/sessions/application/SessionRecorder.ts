import type { ActorType } from "@/features/actors/domain/actor.types";
import type { ExecutionRecord } from "../domain/evidence.types";
import type { SessionSource } from "../domain/session.types";

export interface SessionStart {
  sessionId?: string;
  environmentId: string;
}

export interface RecordEventInput {
  source: SessionSource;
  actor?: { id: string; label: string; type?: ActorType };
  action?: { id: string; label: string; categoryId: string };
  summary: string;
  status: "success" | "failure" | "info";
  execution?: ExecutionRecord;
  position?: { lat: number; lng: number };
}

/**
 * Single application path for recording session events. Applies redaction
 * internally before anything reaches storage. Implementation adopts the
 * current component-level `addEvent` calls in Phase 3.
 */
export interface SessionRecorder {
  start(input: SessionStart): void;
  record(input: RecordEventInput): void;
  stop(): void;
}
