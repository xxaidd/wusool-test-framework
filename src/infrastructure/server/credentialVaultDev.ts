import type {
  AuthContext,
  CredentialVault,
} from "@/features/actors/application/CredentialVault";

/**
 * In-memory credential vault for development. Tokens and credentials are
 * stored server-side only, keyed by `actorId:envId`, and are never exposed
 * to the browser. Clear all state between test sessions via `clearAll`.
 */
export class DevCredentialVault implements CredentialVault {
  private readonly contexts = new Map<string, AuthContext>();

  private key(actorId: string, envId: string): string {
    return `${envId}:${actorId}`;
  }

  async store(
    _actorId: string,
    _envId: string,
    _credentials: import("@/features/actors/domain/actor.types").Credentials,
  ): Promise<void> {
    // Raw credentials are not retained; resolve() performs JIT login.
    return undefined;
  }

  async setContext(
    actorId: string,
    envId: string,
    context: AuthContext,
  ): Promise<void> {
    this.contexts.set(this.key(actorId, envId), context);
  }

  async resolve(actorId: string, envId: string): Promise<AuthContext | null> {
    return this.contexts.get(this.key(actorId, envId)) ?? null;
  }

  async clear(actorId: string, envId: string): Promise<void> {
    this.contexts.delete(this.key(actorId, envId));
  }

  async clearForEnvironment(envId: string): Promise<void> {
    const prefix = `${envId}:`;
    for (const key of this.contexts.keys()) {
      if (key.startsWith(prefix)) this.contexts.delete(key);
    }
  }

  async clearAll(): Promise<void> {
    this.contexts.clear();
  }
}

let singleton: DevCredentialVault | null = null;

/** Shared dev vault instance used by the BFF route handlers. */
export function getDevCredentialVault(): DevCredentialVault {
  if (!singleton) singleton = new DevCredentialVault();
  return singleton;
}

/** Test hook: replace the singleton with a fresh instance. */
export function resetDevCredentialVault(): void {
  singleton = new DevCredentialVault();
}
