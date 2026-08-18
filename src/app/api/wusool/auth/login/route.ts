import { z } from "zod";
import { getDevCredentialVault } from "@/infrastructure/server/credentialVaultDev";
import { resolveEnvironment } from "@/infrastructure/server/environmentResolver";
import { serverLogin } from "@/infrastructure/server/wusoolServerClient";
import { fail, ok } from "../../helpers";
import { envInputSchema } from "../../schemas";

const loginSchema = z.object({
  env: envInputSchema,
  actorId: z.string().min(1),
  email: z.string().min(1),
  password: z.string().min(1),
  isDriver: z.boolean().default(false),
});

/**
 * JIT authentication. The backend tokens are stored in the server-side vault
 * keyed by `(actorId, env)` and never returned to the browser.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = loginSchema.parse(await request.json());
    const env = resolveEnvironment(body.env);
    const tokens = await serverLogin(
      env,
      {
        email: body.email,
        password: body.password,
      },
      body.isDriver,
    );
    await getDevCredentialVault().setContext(body.actorId, env.id, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    return ok({ authenticated: true });
  } catch (err) {
    return fail(err);
  }
}
