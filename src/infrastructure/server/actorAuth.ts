import type {
  AuthContext,
  CredentialVault,
} from "@/features/actors/application/CredentialVault";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { serverRefresh } from "@/infrastructure/server/wusoolServerClient";

/** Refresh the access token a short while before it actually expires. */
const REFRESH_BUFFER_MS = 30_000;

/** Single in-flight refresh per environment+actor so concurrent calls share one. */
const inFlightRefresh = new Map<string, Promise<AuthContext>>();

/** Test hook: forget any in-flight refreshes. */
export function resetActorAuthRefreshes(): void {
  inFlightRefresh.clear();
}

function needsRefresh(ctx: AuthContext): boolean {
  return (
    ctx.expiresAt != null && ctx.expiresAt <= Date.now() + REFRESH_BUFFER_MS
  );
}

async function refreshContext(
  vault: CredentialVault,
  env: BackendEnvironment,
  actorId: string,
  ctx: AuthContext,
): Promise<AuthContext> {
  if (!ctx.refreshToken) {
    throw new Error("Actor token expired and no refresh token is available.");
  }
  const refreshToken = ctx.refreshToken;
  const key = `${env.id}:${actorId}`;
  const pending = inFlightRefresh.get(key);
  if (pending) return pending;

  const refreshing = (async () => {
    const tokens = await serverRefresh(env, refreshToken);
    const next: AuthContext = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? ctx.refreshToken,
      expiresAt: tokens.expiresAt,
    };
    await vault.setContext(actorId, env.id, next);
    return next;
  })().finally(() => inFlightRefresh.delete(key));

  inFlightRefresh.set(key, refreshing);
  return refreshing;
}

/**
 * Resolve a usable access token for an actor, silently refreshing it when it
 * is expired or near expiry. Returns `null` when there is no stored context or
 * the token cannot be refreshed, so the execute route can surface `needs-auth`
 * (the UI then prompts the tester for credentials).
 */
export async function resolveActorToken(
  vault: CredentialVault,
  env: BackendEnvironment,
  actorId: string,
): Promise<string | null> {
  const ctx = await vault.resolve(actorId, env.id);
  if (!ctx) return null;
  // Unknown expiry (opaque token) is used as-is: no expiry information to act on.
  if (ctx.expiresAt == null) return ctx.accessToken;
  if (!needsRefresh(ctx)) return ctx.accessToken;
  try {
    const next = await refreshContext(vault, env, actorId, ctx);
    return next.accessToken;
  } catch {
    return null;
  }
}
