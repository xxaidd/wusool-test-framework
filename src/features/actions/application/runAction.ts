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
import type {
  SanitizedRequest,
  SanitizedResponse,
} from "@/shared/redaction/redact";

export interface ActionOutcome {
  ok: boolean;
  needsAuth: boolean;
  data?: unknown;
  statusCode?: number;
  error?: string;
  durationMs: number;
  correlation?: CorrelationInfo;
  request: SanitizedRequest;
  response?: SanitizedResponse;
  position?: { lat: number; lng: number };
}

export interface RunActionInput {
  env: BackendEnvironment;
  actor: ActorRef;
  action: ActionDef;
  args: Record<string, unknown>;
  position?: { lat: number; lng: number };
  /** Resolved bearer token, if available (server-side only in the BFF flow). */
  token?: string;
  repo: ActionRepository;
  signal?: AbortSignal;
}

/**
 * Execute a client action against the real backend on behalf of an actor.
 * The repository decides whether authentication is required; when it reports
 * `needs-auth`, the outcome surfaces it so the UI can prompt the tester for
 * credentials (FR-06 / FR-22). Sanitized request/response from the repository
 * overwrite the locally-built preview whenever available.
 */
export async function runAction(input: RunActionInput): Promise<ActionOutcome> {
  const { env, actor, action, args, position, token, repo, signal } = input;

  const path = buildPath(action, args, actor);
  const query = buildQuery(action, args);
  const method = action.method;

  const isBody = ["POST", "PUT", "PATCH"].includes(method);
  const body = isBody ? buildBody(action, args, actor) : undefined;

  const preview: SanitizedRequest = {
    method,
    path,
    ...(query != null ? { query } : {}),
    headers: token ? { Authorization: "Bearer •••" } : {},
    ...(body != null ? { body: JSON.stringify(body, null, 2) } : {}),
  };

  const outcome: ActionOutcome = {
    ok: false,
    needsAuth: false,
    request: preview,
    durationMs: 0,
    position,
  };

  const started = performance.now();
  const result = await repo.execute({
    env,
    actor,
    action,
    args,
    token,
    signal,
  });

  if (result.status === "success") {
    outcome.ok = true;
    outcome.data = result.data;
    outcome.statusCode = result.statusCode;
    outcome.correlation = result.correlation;
    outcome.request = result.request ?? preview;
    outcome.response = result.response ?? {
      statusCode: result.statusCode,
      headers: {},
      body: JSON.stringify(result.data ?? null, null, 2),
    };
  } else if (result.status === "needs-auth") {
    outcome.needsAuth = true;
    outcome.correlation = result.correlation;
    outcome.statusCode = 401;
    outcome.error = "Authentication required";
    outcome.request = result.request ?? preview;
    outcome.response = result.response ?? {
      statusCode: 401,
      headers: {},
      body: "Authentication required",
    };
  } else {
    outcome.statusCode = result.statusCode;
    outcome.error = result.message;
    outcome.correlation = result.correlation;
    outcome.request = result.request ?? preview;
    outcome.response = result.response ?? {
      statusCode: result.statusCode ?? 0,
      headers: {},
      body: result.message,
    };
  }
  outcome.durationMs = Math.round(performance.now() - started);
  return outcome;
}
