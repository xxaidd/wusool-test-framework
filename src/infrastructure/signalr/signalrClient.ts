import {
  type HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";

export type ConnectionState = "connected" | "disconnected" | "reconnecting";

export interface SignalRConnectionOptions {
  hubUrl: string;
  accessToken: string;
}

export interface SignalRLifecycle {
  start(): Promise<void>;
  stop(): Promise<void>;
  invoke(method: string, ...args: unknown[]): Promise<unknown>;
  onReceive(method: string, callback: (...args: unknown[]) => void): void;
  offReceive(method: string, callback: (...args: unknown[]) => void): void;
  getConnectionState(): ConnectionState;
  onConnectionChange(callback: (state: ConnectionState) => void): () => void;
}

/**
 * Manages a single SignalR hub connection. Handles connection lifecycle,
 * reconnection, and state-change notifications. Environment-scoped: callers
 * must stop() before switching environments.
 *
 * Tokens are NOT logged, persisted, or exposed to the browser outside the
 * in-memory connection object.
 */
export class SignalRConnectionManager implements SignalRLifecycle {
  private connection: HubConnection | null = null;
  private stateCallbacks: Array<(state: ConnectionState) => void> = [];
  private receiveListeners = new Map<
    string,
    Array<(...args: unknown[]) => void>
  >();
  private currentState: ConnectionState = "disconnected";
  private options: SignalRConnectionOptions | null = null;

  async start(): Promise<void> {
    if (!this.options) {
      throw new Error("SignalR: no connection options provided");
    }
    if (
      this.connection &&
      this.connection.state !== HubConnectionState.Disconnected
    ) {
      return;
    }

    this.connection = new HubConnectionBuilder()
      .withUrl(this.options.hubUrl, {
        accessTokenFactory: () => this.options?.accessToken ?? "",
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) =>
          Math.min(1000 * 2 ** retryContext.previousRetryCount, 30000),
      })
      .configureLogging(LogLevel.Warning)
      .build();

    this.connection.onreconnecting(() => {
      this.setState("reconnecting");
    });
    this.connection.onreconnected(() => {
      this.setState("connected");
    });
    this.connection.onclose(() => {
      this.setState("disconnected");
    });

    // Re-register receive listeners after reconnect
    for (const [method, callbacks] of this.receiveListeners) {
      for (const cb of callbacks) {
        this.connection.on(method, cb);
      }
    }

    await this.connection.start();
    this.setState("connected");
  }

  async stop(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
    this.setState("disconnected");
  }

  async invoke(method: string, ...args: unknown[]): Promise<unknown> {
    if (
      !this.connection ||
      this.connection.state !== HubConnectionState.Connected
    ) {
      throw new Error("SignalR: not connected");
    }
    return this.connection.invoke(method, ...args);
  }

  onReceive(method: string, callback: (...args: unknown[]) => void): void {
    if (!this.receiveListeners.has(method)) {
      this.receiveListeners.set(method, []);
    }
    this.receiveListeners.get(method)?.push(callback);

    if (this.connection) {
      this.connection.on(method, callback);
    }
  }

  offReceive(method: string, callback: (...args: unknown[]) => void): void {
    const listeners = this.receiveListeners.get(method);
    if (listeners) {
      const idx = listeners.indexOf(callback);
      if (idx >= 0) listeners.splice(idx, 1);
    }
    if (this.connection) {
      this.connection.off(method, callback);
    }
  }

  getConnectionState(): ConnectionState {
    return this.currentState;
  }

  onConnectionChange(callback: (state: ConnectionState) => void): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      const idx = this.stateCallbacks.indexOf(callback);
      if (idx >= 0) this.stateCallbacks.splice(idx, 1);
    };
  }

  configure(options: SignalRConnectionOptions): void {
    this.options = options;
  }

  private setState(state: ConnectionState): void {
    if (this.currentState === state) return;
    this.currentState = state;
    for (const cb of this.stateCallbacks) {
      try {
        cb(state);
      } catch {
        // Prevent listener errors from breaking state management
      }
    }
  }
}

let singleton: SignalRConnectionManager | null = null;

/** Shared connection manager instance. One connection per environment. */
export function getSignalRConnection(): SignalRConnectionManager {
  if (!singleton) singleton = new SignalRConnectionManager();
  return singleton;
}

/** Test hook: replace the singleton with a fresh instance. */
export function resetSignalRConnection(): void {
  if (singleton) {
    singleton.stop().catch(() => {});
  }
  singleton = null;
}
