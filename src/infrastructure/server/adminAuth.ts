import type {
  AuthContext,
  CredentialVault,
} from "@/features/actors/application/CredentialVault";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import {
  ServerApiError,
  type ServerRequestOptions,
  type ServerResponseData,
  serverRefresh,
  serverRequest,
} from "@/infrastructure/server/wusoolServerClient";
import { AppError } from "@/shared/errors";

/**
 * Signed, structured failure raised when the admin/session-manager token is
 * missing, expired without a usable refresh token, or refresh itself failed.
 * The BFF maps it to `ADMIN_AUTH_REQUIRED` so the UI can prompt for re-entry
 * without losing workspace state.
 */
export class AdminAuthRequiredError extends AppError {
  constructor(message = "Admin authentication is required.") {
    super("ADMIN_AUTH_REQUIRED", message);
  }
}

/** Refresh the access token a short while before it actually expires. */
const REFRESH_BUFFER_MS = 30_000;

/** Single in-flight refresh per environment so concurrent calls share one. */
const inFlightRefresh = new Map<string, Promise<AuthContext>>();

/** Test hook: forget any in-flight refreshes. */
export function resetAdminAuthRefreshes(): void {
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
  ctx: AuthContext,
): Promise<AuthContext> {
  if (!ctx.refreshToken) {
    throw new AdminAuthRequiredError(
      "Admin token expired and no refresh token is available.",
    );
  }
  const refreshToken = ctx.refreshToken;
  const pending = inFlightRefresh.get(env.id);
  if (pending) return pending;

  const refreshing = (async () => {
    const tokens = await serverRefresh(env, refreshToken);
    const next: AuthContext = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? ctx.refreshToken,
      expiresAt: tokens.expiresAt,
    };
    await vault.setAdminContext(env.id, next);
    return next;
  })().finally(() => inFlightRefresh.delete(env.id));

  inFlightRefresh.set(env.id, refreshing);
  return refreshing;
}

/**
 * Resolve a usable admin access token for the environment, silently
 * refreshing it when expired or near expiry. Returns `null` when the
 * environment has no admin context or the token cannot be refreshed.
 */
export async function resolveAdminToken(
  vault: CredentialVault,
  env: BackendEnvironment,
): Promise<string | null> {
  const ctx = await vault.resolveAdminContext(env.id);
  if (!ctx) return null;
  if (!needsRefresh(ctx)) return ctx.accessToken;
  try {
    const next = await refreshContext(vault, env, ctx);
    return next.accessToken;
  } catch {
    return null;
  }
}

/**
 * Perform a backend request using the environment's admin token. The token is
 * refreshed on expiry and, if the backend rejects it mid-flight with 401/403,
 * a single refresh + retry is attempted before the error propagates.
 */
export async function adminRequest(
  vault: CredentialVault,
  env: BackendEnvironment,
  path: string,
  opts: Omit<ServerRequestOptions, "token"> = {},
): Promise<ServerResponseData> {
  const token = await resolveAdminToken(vault, env);
  if (!token) throw new AdminAuthRequiredError();

  try {
    return await serverRequest(env, path, { ...opts, token });
  } catch (err) {
    const canRetry =
      err instanceof ServerApiError &&
      (err.status === 401 || err.status === 403);
    if (!canRetry) throw err;

    const ctx = await vault.resolveAdminContext(env.id);
    if (!ctx?.refreshToken) throw err;

    const next = await refreshContext(vault, env, ctx);
    return serverRequest(env, path, { ...opts, token: next.accessToken });
  }
}
