import {
  buildBody,
  buildPath,
  buildQuery,
  refreshDependencies,
  summarizeAction,
  validateActionArgs,
} from "@/features/actions/application/actionCatalog";
import type { ActionRepository } from "@/features/actions/application/actionRepository";
import type {
  ActionDef,
  ActionSummary,
  EntityKind,
  ExecutionMode,
} from "@/features/actions/domain/action.types";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { buildExecutionRecord } from "@/features/sessions/application/buildExecutionRecord";
import type { SessionRecorder } from "@/features/sessions/application/SessionRecorder";
import { SessionSource } from "@/features/sessions/domain/session.types";
import { ValidationError, type FailureClassification } from "@/shared/errors";
import type { CorrelationInfo } from "@/shared/lib/correlation";
import { createId } from "@/shared/lib/ids";
import type {
  SanitizedRequest,
  SanitizedResponse,
} from "@/shared/redaction/redact";

/**
 * Normalized, evidence-ready outcome of ONE executed action. Every execution
 * carries a unique {@link executionId}, a normalized outcome, sanitized
 * request/response evidence, and a human-readable {@link summary}. This exact
 * shape is shared by manual and (later) workflow execution.
 */
export interface ActionExecution {
  executionId: string;
  ok: boolean;
  needsAuth: boolean;
  statusCode?: number;
  data?: unknown;
  error?: string;
  durationMs: number;
  correlation?: CorrelationInfo;
  summary: ActionSummary;
  request: SanitizedRequest;
  response?: SanitizedResponse;
  position?: { lat: number; lng: number };
  /** Whether the required supporting backend state was refreshed before execution. */
  refreshed: boolean;
  /** Non-fatal message when a required state refresh failed. */
  refreshError?: string;
  /** Distinguishes normal failed actions from infrastructure failures. */
  classification?: FailureClassification;
}

export interface ExecuteActionInput {
  env: BackendEnvironment;
  actor: ActorRef;
  action: ActionDef;
  args: Record<string, unknown>;
  position?: { lat: number; lng: number };
  /** Resolved bearer token, if available (server-side only in the BFF flow). */
  token?: string;
  repo: ActionRepository;
  signal?: AbortSignal;
  /** `invalid` is the advanced invalid-test mode: it skips normal per-action
   *  validation on purpose. Never weakens the normal path. */
  mode?: ExecutionMode;
  /** Best-effort hook to refresh supporting entity state before executing. */
  refresh?: (kinds: EntityKind[]) => Promise<void>;
  /** Centralized session recorder; when provided the outcome is recorded. */
  recorder?: SessionRecorder;
  /** Localized human summary stored with the recorded event. */
  summary?: string;
  /** Localized action label stored with the recorded event. */
  actionLabel?: string;
}

/**
 * The single application path for executing a client action against the real
 * backend on behalf of an actor. Validates user inputs per action, refreshes
 * required backend state, invokes the {@link ActionRepository}, and normalizes
 * a unique, evidence-safe, human-readable outcome. Manual and workflow
 * execution both go through this exact executor.
 *
 * When a {@link SessionRecorder} is provided, success and failure outcomes are
 * recorded through it (needs-auth stays a UI prompt concern and is not
 * recorded). The recorder must apply redaction before anything reaches storage.
 */
export async function executeAction(
  input: ExecuteActionInput,
): Promise<ActionExecution> {
  const {
    env,
    actor,
    action,
    args,
    position,
    token,
    repo,
    signal,
    mode = "normal",
    refresh,
  } = input;

  const executionId = createId("exec");
  const started = performance.now();
  const method = action.transport.method;

  if (mode === "normal") {
    const validation = validateActionArgs(action, args);
    if (!validation.ok) {
      throw new ValidationError("action.validationFailed");
    }
  }

  const path = buildPath(action, args, actor);
  const query = buildQuery(action, args);
  const isBody = ["POST", "PUT", "PATCH"].includes(method);
  const body = isBody ? buildBody(action, args, actor) : undefined;

  const preview: SanitizedRequest = {
    method,
    path,
    ...(query != null ? { query } : {}),
    headers: token ? { Authorization: "Bearer •••" } : {},
    ...(body != null ? { body: JSON.stringify(body, null, 2) } : {}),
  };

  // Refresh required supporting backend state (best-effort; never blocks the
  // action or silently swallows: any failure is surfaced on the outcome).
  const kinds = refreshDependencies(action);
  let refreshed = kinds.length === 0;
  let refreshError: string | undefined;
  if (kinds.length > 0) {
    try {
      await refresh?.(kinds);
      refreshed = true;
    } catch (err) {
      refreshed = false;
      refreshError =
        err instanceof Error ? err.message : "Failed to refresh backend state";
    }
  }

  const outcome: ActionExecution = {
    executionId,
    ok: false,
    needsAuth: false,
    request: preview,
    durationMs: 0,
    summary: { key: action.metadata.summaryKey },
    position,
    refreshed,
    ...(refreshError != null ? { refreshError } : {}),
  };

  const startedAt = new Date().toISOString();
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
  outcome.summary = summarizeAction(action, {
    actorLabel: actor.label,
    args,
    data: outcome.data,
    ok: outcome.ok,
    needsAuth: outcome.needsAuth,
  });

  if (input.recorder && input.summary != null && !outcome.needsAuth) {
    input.recorder.record({
      source: SessionSource.Manual,
      actor: { id: actor.id, label: actor.label, type: actor.type },
      action: {
        id: action.metadata.id,
        label: input.actionLabel ?? action.metadata.labelKey,
        categoryId: action.metadata.category,
      },
      summary: input.summary,
      status: outcome.ok ? "success" : "failure",
      ...(outcome.error != null ? { error: outcome.error } : {}),
      ...(outcome.position != null ? { position: outcome.position } : {}),
      baseUrl: env.baseUrl,
      execution: buildExecutionRecord({
        envId: env.id,
        actorId: actor.id,
        actionId: action.metadata.id,
        startedAt,
        outcome,
      }),
    });
  }

  return outcome;
}