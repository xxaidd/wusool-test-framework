import {
  buildBody,
  buildPath,
  buildQuery,
} from "@/features/actions/application/actionCatalog";
import type { ActionRepository } from "@/features/actions/application/actionRepository";
import type { ActionDef } from "@/features/actions/domain/action.types";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import type { CorrelationInfo } from "@/shared/lib/correlation";

export interface ActionOutcome {
  ok: boolean;
  needsAuth: boolean;
  data?: unknown;
  statusCode?: number;
  error?: string;
  durationMs: number;
  correlation?: CorrelationInfo;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  response?: { status: number; headers: Record<string, string>; body: string };
  position?: { lat: number; lng: number };
}

export interface RunActionInput {
  env: BackendEnvironment;
  actor: ActorRef;
  action: ActionDef;
  args: Record<string, unknown>;
  position?: { lat: number; lng: number };
  /** Resolved bearer token, if the actor is authenticated. */
  token?: string;
  repo: ActionRepository;
  signal?: AbortSignal;
}

/**
 * Execute a client action against the real backend on behalf of an actor.
 * Returns `needsAuth` when authentication is required but not yet supplied,
 * so the UI can prompt the tester for credentials (FR-06 / FR-22).
 */
export async function runAction(input: RunActionInput): Promise<ActionOutcome> {
  const { env, actor, action, args, position, token, repo, signal } = input;
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
  const result = await repo.execute({
    env,
    path,
    method,
    token,
    params: query,
    data: body,
    signal,
  });

  if (result.status === "success") {
    outcome.ok = true;
    outcome.data = result.data;
    outcome.statusCode = result.statusCode;
    outcome.correlation = result.correlation;
    outcome.response = {
      status: result.statusCode,
      headers: {},
      body: JSON.stringify(result.data ?? null, null, 2),
    };
  } else if (result.status === "needs-auth") {
    outcome.needsAuth = true;
    outcome.correlation = result.correlation;
    outcome.statusCode = 401;
    outcome.error = "Authentication required";
    outcome.response = {
      status: 401,
      headers: {},
      body: "Authentication required",
    };
  } else {
    outcome.statusCode = result.statusCode;
    outcome.error = result.message;
    outcome.correlation = result.correlation;
    outcome.response = {
      status: result.statusCode ?? 0,
      headers: {},
      body: result.message,
    };
  }
  outcome.durationMs = Math.round(performance.now() - started);
  return outcome;
}
