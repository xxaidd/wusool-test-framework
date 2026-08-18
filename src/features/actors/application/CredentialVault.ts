import type { Credentials } from "../domain/actor.types";

/**
 * Resolved actor authentication context. Server-side only: it must never
 * cross to presentation, domain events, session exports, or logs
 * (redaction policy §4).
 */
export interface AuthContext {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

/**
 * Stores and resolves actor credentials/auth contexts keyed by
 * (actorId, environmentId). Implementations are infrastructure
 * (dev adapter in Phase 1; durable vault before multi-instance deployment).
 */
export interface CredentialVault {
  store(
    actorId: string,
    envId: string,
    credentials: Credentials,
  ): Promise<void>;
  resolve(actorId: string, envId: string): Promise<AuthContext | null>;
  clear(actorId: string, envId: string): Promise<void>;
  clearForEnvironment(envId: string): Promise<void>;
  clearAll(): Promise<void>;
}
