import { z } from "zod";
import { getDevCredentialVault } from "@/infrastructure/server/credentialVaultDev";
import { resolveEnvironment } from "@/infrastructure/server/environmentResolver";
import { serverLogin } from "@/infrastructure/server/wusoolServerClient";
import { AuthenticationError } from "@/shared/errors";
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
    const env = await resolveEnvironment(body.env);
    const tokens = await serverLogin(
      env,
      {
        email: body.email,
        password: body.password,
      },
      body.isDriver,
    );
    // Never store a token-less context: a 2FA-required or malformed response
    // must fail loudly instead of appearing to succeed and then re-prompting.
    if (tokens.requiresTwoFactor) {
      throw new AuthenticationError(
        "Two-factor authentication is required but is not supported by the framework.",
      );
    }
    if (!tokens.accessToken) {
      throw new AuthenticationError("The backend returned no access token.");
    }
    await getDevCredentialVault().setContext(body.actorId, env.id, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });
    return ok({ authenticated: true });
  } catch (err) {
    return fail(err);
  }
}
