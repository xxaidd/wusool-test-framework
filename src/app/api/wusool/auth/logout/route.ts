import { z } from "zod";
import { getDevCredentialVault } from "@/infrastructure/server/credentialVaultDev";
import { resolveEnvironment } from "@/infrastructure/server/environmentResolver";
import { fail, ok } from "../../helpers";
import { envInputSchema } from "../../schemas";

const logoutSchema = z.object({
  env: envInputSchema,
  actorId: z.string().optional(),
});

/**
 * Clear vault auth contexts. With `actorId` only that actor's context is
 * removed; without it the whole environment's contexts are cleared (used on
 * environment switch). Tokens never cross the wire — the route only mutates
 * the server-side vault.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = logoutSchema.parse(await request.json());
    const env = await resolveEnvironment(body.env);
    const vault = getDevCredentialVault();
    if (body.actorId) {
      await vault.clear(body.actorId, env.id);
    } else {
      await vault.clearForEnvironment(env.id);
    }
    return ok({ cleared: true });
  } catch (err) {
    return fail(err);
  }
}
