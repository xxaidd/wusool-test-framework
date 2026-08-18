import { z } from "zod";
import type {
  ActorRef,
  CreateActorInput,
} from "@/features/actors/domain/actor.types";
import { ActorSource, ActorType } from "@/features/actors/domain/actor.types";
import { getDevCredentialVault } from "@/infrastructure/server/credentialVaultDev";
import { resolveEnvironment } from "@/infrastructure/server/environmentResolver";
import {
  serverRegister,
  serverRequest,
} from "@/infrastructure/server/wusoolServerClient";
import { ValidationError } from "@/shared/errors";
import { fail, ok } from "../helpers";
import { createActorInputSchema, envInputSchema } from "../schemas";

const createSchema = z.object({
  env: envInputSchema,
  adminToken: z.string().optional(),
  input: createActorInputSchema,
});

/**
 * Create a test actor. Passengers register anonymously and their session is
 * stored in the server-side vault (never exposed to the browser). Drivers and
 * buses require an admin token.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = createSchema.parse(await request.json());
    const env = resolveEnvironment(body.env);
    const vault = getDevCredentialVault();
    const input = body.input as CreateActorInput;

    if (input.type === ActorType.Passenger) {
      const email = input.email ?? "";
      const password = input.password ?? "";
      const { tokens, userId } = await serverRegister(env, {
        email,
        password,
        fullName: input.name,
      });
      const id = userId || String(Date.now());
      await vault.setContext(id, env.id, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
      const actor: ActorRef = {
        id,
        type: ActorType.Passenger,
        label: input.name || email,
        sublabel: email,
        authenticated: true,
        source: ActorSource.Test,
        raw: { email, userId },
      };
      return ok(actor);
    }

    if (input.type === ActorType.Driver) {
      const data = (await serverRequest(env, "/api/v1/admin/drivers", {
        method: "POST",
        token: body.adminToken,
        data: {
          email: input.email ?? "",
          password: input.password ?? "",
          fullName: input.name,
        },
      })) as unknown as {
        driverId?: number | string;
        id?: number | string;
      } | null;
      const actor: ActorRef = {
        id: String(data?.driverId ?? data?.id ?? Date.now()),
        type: ActorType.Driver,
        label: input.name || (input.email ?? ""),
        sublabel: input.email ?? "",
        authenticated: false,
        source: ActorSource.Test,
        raw: (data as Record<string, unknown> | null) ?? { email: input.email },
      };
      return ok(actor);
    }

    if (input.type === ActorType.Bus) {
      const data = (await serverRequest(env, "/api/v1/buses", {
        method: "POST",
        token: body.adminToken,
        data: {
          plateNumber: input.plateNumber,
          capacity: input.capacityNumber,
        },
      })) as unknown as { id?: number | string } | null;
      const actor: ActorRef = {
        id: String(data?.id ?? Date.now()),
        type: ActorType.Bus,
        label: input.plateNumber || `Bus ${data?.id ?? ""}`,
        sublabel: `${input.capacityNumber ?? ""} seats`.trim(),
        authenticated: false,
        source: ActorSource.Test,
        raw: (data as Record<string, unknown> | null) ?? {
          plateNumber: input.plateNumber,
        },
      };
      return ok(actor);
    }

    throw new ValidationError(`Unsupported actor type "${input.type}".`);
  } catch (err) {
    return fail(err);
  }
}
