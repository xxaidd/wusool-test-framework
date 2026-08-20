import {
  buildBody,
  buildPath,
  buildQuery,
} from "@/features/actions/application/actionCatalog";
import type { ActionRepository } from "@/features/actions/application/actionRepository";
import type { ActionDef } from "@/features/actions/domain/action.types";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { buildExecutionRecord } from "@/features/sessions/application/buildExecutionRecord";
import type { SessionRecorder } from "@/features/sessions/application/SessionRecorder";
import { SessionSource } from "@/features/sessions/domain/session.types";
import type { FailureClassification } from "@/shared/errors";
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
  /** Distinguishes normal failed actions from infrastructure failures. */
  classification?: FailureClassification;
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
  /** Centralized session recorder; when provided the outcome is recorded. */
  recorder?: SessionRecorder;
  /** Localized human summary stored with the recorded event. */
  summary?: string;
  /** Localized action label stored with the recorded event. */
  actionLabel?: string;
}

/**
 * Execute a client action against the real backend on behalf of an actor.
 * The repository decides whether authentication is required; when it reports
 * `needs-auth`, the outcome surfaces it so the UI can prompt the tester for
 * credentials (FR-06 / FR-22). Sanitized request/response from the repository
 * overwrite the locally-built preview whenever available.
 *
 * When a {@link SessionRecorder} is provided, success and failure outcomes are
 * recorded through it (needs-auth stays a UI prompt concern and is not
 * recorded). Manual and workflow execution share this exact path.
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

  const startedAt = new Date().toISOString();
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
    outcome.classification = { kind: "success" };
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
    outcome.classification = { kind: "authorization", needsAuth: true };
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
    outcome.classification = result.classification;
  }
  outcome.durationMs = Math.round(performance.now() - started);

  if (input.recorder && input.summary != null && !outcome.needsAuth) {
    input.recorder.record({
      source: SessionSource.Manual,
      actor: { id: actor.id, label: actor.label, type: actor.type },
      action: {
        id: action.id,
        label: input.actionLabel ?? action.labelKey,
        categoryId: action.category,
      },
      summary: input.summary,
      status: outcome.ok ? "success" : "failure",
      ...(outcome.error != null ? { error: outcome.error } : {}),
      ...(outcome.position != null ? { position: outcome.position } : {}),
      baseUrl: env.baseUrl,
      execution: buildExecutionRecord({
        envId: env.id,
        actorId: actor.id,
        actionId: action.id,
        startedAt,
        outcome,
      }),
    });
  }

  return outcome;
}
