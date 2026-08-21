import { z } from "zod";
import { resolveActorToken } from "@/infrastructure/server/actorAuth";
import { getDevCredentialVault } from "@/infrastructure/server/credentialVaultDev";
import { resolveEnvironment } from "@/infrastructure/server/environmentResolver";
import { fail, ok } from "../../helpers";
import { actorSafeSchema, envInputSchema } from "../../schemas";

/**
 * Driver location hub path on the Wusool backend. Verified against
 * `Program.cs`: `DriverHub` (with the `UpdateLocation(latitude, longitude)`
 * method) is mapped at `/Bus/driver`. Note `/Bus/location/trip` hosts a
 * different hub (`BusLocationHub`) and must not be used for driver pushes.
 */
const DRIVER_HUB_PATH = "/Bus/driver";

const signalrTokenSchema = z.object({
  env: envInputSchema,
  actorId: actorSafeSchema.shape.id,
  hubPath: z.string().min(1).default(DRIVER_HUB_PATH),
});

/**
 * Resolve an actor's bearer token for a SignalR hub connection. The token is
 * returned to the browser so it can establish a WebSocket connection directly
 * with the backend hub. The token is held only in the in-memory SignalR
 * connection object and never persisted, logged, or stored in Zustand.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = signalrTokenSchema.parse(await request.json());
    const env = await resolveEnvironment(body.env);

    const vault = getDevCredentialVault();
    const token = await resolveActorToken(vault, env, body.actorId);

    if (!token) {
      return ok({ connected: false, reason: "needs-auth" });
    }

    const hubUrl = `${env.baseUrl.replace(/\/+$/, "")}${body.hubPath}`;

    return ok({ connected: true, hubUrl, token });
  } catch (err) {
    return fail(err);
  }
}
