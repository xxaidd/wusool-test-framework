import { z } from "zod";
import type { AuthTokens } from "@/features/actors/domain/auth.types";
import { getDevCredentialVault } from "@/infrastructure/server/credentialVaultDev";
import { resolveEnvironment } from "@/infrastructure/server/environmentResolver";
import { extractExpiry } from "@/infrastructure/server/jwtExpiry";
import { serverLogin } from "@/infrastructure/server/wusoolServerClient";
import { fail, ok } from "../../helpers";
import { envInputSchema } from "../../schemas";

const adminLoginSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("credentials"),
    env: envInputSchema,
    email: z.string().min(1),
    password: z.string().min(1),
  }),
  z.object({
    mode: z.literal("token"),
    env: envInputSchema,
    token: z.string().min(1),
  }),
]);

/**
 * Configure the admin/session-manager authentication for an environment.
 * Credentials log in against the backend via `/api/v1/auth/login` (the same
 * endpoint user login uses); a pasted token is stored as-is. The resolved
 * tokens live in the server-side vault keyed by environment and are never
 * returned to the browser — the response carries only `configured`.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = adminLoginSchema.parse(await request.json());
    const env = await resolveEnvironment(body.env);
    const vault = getDevCredentialVault();

    let tokens: AuthTokens;
    if (body.mode === "credentials") {
      tokens = await serverLogin(env, {
        email: body.email,
        password: body.password,
      });
    } else {
      tokens = {
        accessToken: body.token,
        expiresAt: extractExpiry(body.token),
      };
    }

    await vault.setAdminContext(env.id, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });

    return ok({ configured: true });
  } catch (err) {
    return fail(err);
  }
}
