import {
  buildBody,
  buildPath,
  buildQuery,
} from "@/features/actions/application/actionCatalog";
import type { ActionDef } from "@/features/actions/domain/action.types";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { ApiError, apiRequest } from "@/infrastructure/http/WusoolApiClient";
import { useAuthStore } from "@/shared/store/auth.store";

export interface ActionOutcome {
  ok: boolean;
  needsAuth: boolean;
  data?: unknown;
  statusCode?: number;
  error?: string;
  durationMs: number;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  response?: { status: number; headers: Record<string, string>; body: string };
  position?: { lat: number; lng: number };
}

/**
 * Execute a client action against the real backend on behalf of an actor.
 * Returns `needsAuth` when authentication is required but not yet supplied,
 * so the UI can prompt the tester for credentials (FR-06 / FR-22).
 */
export async function runAction(
  env: BackendEnvironment,
  actor: ActorRef,
  action: ActionDef,
  args: Record<string, unknown>,
  position?: { lat: number; lng: number },
): Promise<ActionOutcome> {
  const token = useAuthStore.getState().getToken(actor.id);
  const needsAuth = action.requiresAuth && !token;

  const path = buildPath(action, args, actor);
  const query = buildQuery(action, args);
  const method = action.method;

  const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
  const url = `${env.baseUrl}${path}${qs}`;

  const isBody = ["POST", "PUT", "PATCH"].includes(method);
  const body = isBody ? buildBody(action, args, actor) : undefined;

  const request = {
    method,
    url,
    headers: (needsAuth ? {} : { Authorization: "Bearer •••" }) as Record<
      string,
      string
    >,
    body: body != null ? JSON.stringify(body, null, 2) : undefined,
  };

  const outcome: ActionOutcome = {
    ok: false,
    needsAuth,
    request,
    durationMs: 0,
    position,
  };
  if (needsAuth) return outcome;

  const started = performance.now();
  try {
    const data = await apiRequest(env, path, {
      method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      token,
      params: query,
      data: body,
    });
    outcome.ok = true;
    outcome.data = data;
    outcome.statusCode = 200;
    outcome.response = {
      status: 200,
      headers: {},
      body: JSON.stringify(data, null, 2),
    };
  } catch (err) {
    if (err instanceof ApiError) {
      outcome.statusCode = err.status;
      outcome.error = err.message;
      outcome.response = { status: err.status, headers: {}, body: err.message };
    } else {
      outcome.error = err instanceof Error ? err.message : "Unknown error";
      outcome.statusCode = 0;
    }
  }
  outcome.durationMs = Math.round(performance.now() - started);
  return outcome;
}
