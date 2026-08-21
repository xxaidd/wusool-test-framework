import type {
  ConnectionState,
  LocationPort,
  LocationUpdateResult,
} from "@/features/map/domain/locationPort";
import { bffRequest } from "@/infrastructure/bff/client";
import { getSignalRConnection } from "@/infrastructure/signalr/signalrClient";
import { classifyError } from "@/shared/errors";

const log = (msg: string, meta?: Record<string, unknown>) => {
  const entry = {
    ts: new Date().toISOString(),
    src: "signalr-adapter",
    ...meta,
  };
  if (msg.startsWith("ERR")) console.error("[signalr-adapter]", entry);
  else console.log("[signalr-adapter]", entry);
};

/**
 * SignalR-based location adapter implementing the LocationPort. Sends driver
 * location updates via the `UpdateLocation` hub method on `DriverHub`
 * (`/Bus/driver`; resolved server-side by the BFF token endpoint).
 *
 * Automatically connects to the hub on first send by fetching a token from
 * the BFF. Tokens are held only in the in-memory SignalR connection and never
 * logged, persisted, or exposed to the browser outside the connection object.
 */
export class SignalRLocationAdapter implements LocationPort {
  private connection = getSignalRConnection();

  private isReady(): boolean {
    return this.connection.getConnectionState() === "connected";
  }

  async connect(hubUrl: string, token: string): Promise<void> {
    this.connection.configure({ hubUrl, accessToken: token });
    await this.connection.start();
    log("connected", { hubUrl });
  }

  async disconnect(): Promise<void> {
    await this.connection.stop();
    log("disconnected");
  }

  /** Returns a failure result when connection cannot be established, else null. */
  private async ensureConnected(
    envRef: { envId: string; baseUrl?: string },
    actorId: string,
  ): Promise<LocationUpdateResult | null> {
    const state = this.connection.getConnectionState();
    log("ensureConnected", { currentState: state });

    if (this.isReady()) return null;

    const result = await bffRequest<{
      connected: boolean;
      hubUrl?: string;
      token?: string;
      reason?: string;
    }>("/api/wusool/signalr/token", {
      env: envRef,
      actorId,
    });

    log("bffTokenResult", {
      connected: result.connected,
      hasHubUrl: !!result.hubUrl,
      hasToken: !!result.token,
      reason: result.reason,
    });

    if (!result.connected || !result.hubUrl || !result.token) {
      return {
        ok: false,
        error:
          result.reason === "needs-auth"
            ? "Authentication required for SignalR connection"
            : "Failed to obtain SignalR connection token",
        classification: { kind: "authorization", needsAuth: true },
      };
    }

    try {
      await this.connect(result.hubUrl, result.token);
      return null;
    } catch (connectErr) {
      log("ERR connectFailed", {
        error:
          connectErr instanceof Error ? connectErr.message : String(connectErr),
      });
      return {
        ok: false,
        error: `SignalR connect failed: ${connectErr instanceof Error ? connectErr.message : String(connectErr)}`,
        classification: classifyError(connectErr),
      };
    }
  }

  async sendLocation(
    actorId: string,
    lat: number,
    lng: number,
    envRef: { envId: string; baseUrl?: string },
  ): Promise<LocationUpdateResult> {
    try {
      const failure = await this.ensureConnected(envRef, actorId);
      if (failure) return failure;

      log("invoking UpdateLocation", { actorId, lat, lng });
      await this.connection.invoke("UpdateLocation", lat, lng);
      log("invoke succeeded", { actorId });
      return { ok: true };
    } catch (err) {
      log("ERR invoke failed", {
        error: err instanceof Error ? err.message : String(err),
        actorId,
        lat,
        lng,
      });
      const classification = classifyError(err);
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown SignalR error",
        classification,
      };
    }
  }

  getConnectionState(): ConnectionState {
    return this.connection.getConnectionState();
  }

  onConnectionChange(callback: (state: ConnectionState) => void): () => void {
    return this.connection.onConnectionChange(callback);
  }
}

/** Shared adapter instance. */
let adapterInstance: SignalRLocationAdapter | null = null;

export function getSignalRLocationAdapter(): SignalRLocationAdapter {
  if (!adapterInstance) adapterInstance = new SignalRLocationAdapter();
  return adapterInstance;
}

/** Test hook. */
export function resetSignalRLocationAdapter(): void {
  adapterInstance = null;
}
