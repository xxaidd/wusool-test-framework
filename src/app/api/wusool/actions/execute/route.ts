import { z } from "zod";
import {
  buildBody,
  buildPath,
  buildQuery,
  getAction,
  validateActionArgs,
} from "@/features/actions/application/actionCatalog";
import { executeAction } from "@/features/actions/application/executeAction";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import { resolveActorToken } from "@/infrastructure/server/actorAuth";
import { getDevCredentialVault } from "@/infrastructure/server/credentialVaultDev";
import { resolveEnvironment } from "@/infrastructure/server/environmentResolver";
import { createServerActionRepository } from "@/infrastructure/server/serverActionRepository";
import { ValidationError } from "@/shared/errors";
import { createId } from "@/shared/lib/ids";
import { redactRequest } from "@/shared/redaction/redact";
import { fail, ok } from "../../helpers";
import {
  actorSafeSchema,
  argsSchema,
  envInputSchema,
  positionSchema,
} from "../../schemas";

const executeSchema = z.object({
  env: envInputSchema,
  actor: actorSafeSchema,
  actionId: z.string().min(1),
  args: argsSchema,
  position: positionSchema.optional(),
  /** Advanced invalid-test mode: bypasses normal per-action validation. */
  mode: z.enum(["normal", "invalid"]).default("normal"),
});

/**
 * Execute a framework action on behalf of a browser actor. The action is
 * resolved from the catalog, the actor's token is resolved from the
 * server-side vault (silently refreshing it when expired), and the request is
 * executed through the shared {@link executeAction} executor with a fresh
 * correlation id. `needs-auth` is decided here from the vault without hitting
 * the backend. Every execution returns a unique execution id and sanitized
 * evidence.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = executeSchema.parse(await request.json());
    const env = await resolveEnvironment(body.env);
    const action = getAction(body.actionId);
    if (!action) {
      throw new ValidationError(`Unknown action "${body.actionId}".`);
    }
    if (!action.metadata.verified) {
      throw new ValidationError(
        `Action "${body.actionId}" is not contract-verified and cannot be executed.`,
      );
    }

    // Validate per-action inputs before resolving auth/vault so invalid inputs
    // are rejected regardless of the actor's authentication state. Advanced
    // invalid-test mode deliberately bypasses this (FR-18).
    if (body.mode !== "invalid") {
      const validation = validateActionArgs(action, body.args);
      if (!validation.ok) {
        throw new ValidationError("action.validationFailed");
      }
    }

    const actor: ActorRef = {
      ...body.actor,
      raw: { id: body.actor.id },
    };

    const correlationId = createId("req");
    const vault = getDevCredentialVault();

    let token: string | undefined;
    if (action.metadata.requiresAuth) {
      token = (await resolveActorToken(vault, env, actor.id)) ?? undefined;
    }

    const repo = createServerActionRepository(correlationId);

    if (action.metadata.requiresAuth && !token) {
      const method = action.transport.method;
      const path = buildPath(action, body.args, actor);
      const query = buildQuery(action, body.args);
      const isBody = ["POST", "PUT", "PATCH"].includes(method);
      const reqBody = isBody ? buildBody(action, body.args, actor) : undefined;
      const requestEvidence = redactRequest({
        method,
        path,
        query,
        headers: {},
        body: reqBody,
      });
      return ok({
        ok: false,
        needsAuth: true,
        statusCode: 401,
        error: "Authentication required",
        correlation: { correlationId },
        executionId: createId("exec"),
        request: requestEvidence,
        durationMs: 0,
        position: body.position,
        summary: { key: "action.authRequired" },
      });
    }

    const execution = await executeAction({
      env,
      actor,
      action,
      args: body.args,
      position: body.position,
      token,
      repo,
      mode: body.mode,
    });

    return ok({
      ok: execution.ok,
      needsAuth: execution.needsAuth,
      statusCode: execution.statusCode,
      data: execution.data,
      error: execution.error,
      correlation: execution.correlation,
      executionId: execution.executionId,
      request: execution.request,
      response: execution.response,
      durationMs: execution.durationMs,
      position: execution.position,
      refreshed: execution.refreshed,
      refreshError: execution.refreshError,
      classification: execution.classification,
      summary: execution.summary,
    });
  } catch (err) {
    return fail(err);
  }
}
