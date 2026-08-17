import type { ActorType } from "@/features/actors/domain/actor.types";

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
}

export interface SessionState {
  recording: boolean;
  events: SessionEvent[];
  startedAt?: string;
  paused: boolean;
}
