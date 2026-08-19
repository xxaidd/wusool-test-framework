import { z } from "zod";
import {
  buildBody,
  buildPath,
  buildQuery,
  getAction,
} from "@/features/actions/application/actionCatalog";
import { runAction } from "@/features/actions/application/runAction";
import type { ActorRef } from "@/features/actors/domain/actor.types";
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
});

/**
 * Execute a framework action on behalf of a browser actor. The action is
 * resolved from the catalog, the actor's token is resolved from the
 * server-side vault, and the request is executed with a fresh correlation id.
 * `needs-auth` is decided here from the vault without hitting the backend.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = executeSchema.parse(await request.json());
    const env = await resolveEnvironment(body.env);
    const action = getAction(body.actionId);
    if (!action) {
      throw new ValidationError(`Unknown action "${body.actionId}".`);
    }
    if (!action.verified) {
      throw new ValidationError(
        `Action "${body.actionId}" is not contract-verified and cannot be executed.`,
      );
    }

    const actor: ActorRef = {
      ...body.actor,
      raw: { id: body.actor.id },
    };

    const correlationId = createId("req");
    const vault = getDevCredentialVault();

    let token: string | undefined;
    if (action.requiresAuth) {
      const ctx = await vault.resolve(actor.id, env.id);
      const expired = ctx?.expiresAt != null && ctx.expiresAt <= Date.now();
      if (ctx && !expired) token = ctx.accessToken;
    }

    const repo = createServerActionRepository(correlationId);

    if (action.requiresAuth && !token) {
      const method = action.method;
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
        request: requestEvidence,
        durationMs: 0,
        position: body.position,
      });
    }

    const outcome = await runAction({
      env,
      actor,
      action,
      args: body.args,
      position: body.position,
      token,
      repo,
    });

    return ok({
      ok: outcome.ok,
      needsAuth: outcome.needsAuth,
      statusCode: outcome.statusCode,
      data: outcome.data,
      error: outcome.error,
      correlation: outcome.correlation,
      request: outcome.request,
      response: outcome.response,
      durationMs: outcome.durationMs,
      position: outcome.position,
    });
  } catch (err) {
    return fail(err);
  }
}
