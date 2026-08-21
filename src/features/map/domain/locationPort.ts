import type { FailureClassification } from "@/shared/errors";

export type ConnectionState = "connected" | "disconnected" | "reconnecting";

export type LocationUpdateResult =
  | { ok: true }
  | { ok: false; error: string; classification: FailureClassification };

/**
 * Port for sending actor location updates to the backend. Implementations
 * live in infrastructure (SignalR adapter); domain/application code depends
 * only on this interface.
 */
export interface LocationPort {
  sendLocation(
    actorId: string,
    lat: number,
    lng: number,
    envRef: { envId: string; baseUrl?: string },
  ): Promise<LocationUpdateResult>;
  getConnectionState(): ConnectionState;
  onConnectionChange(callback: (state: ConnectionState) => void): () => void;
  connect(hubUrl: string, token: string): Promise<void>;
  disconnect(): Promise<void>;
}
