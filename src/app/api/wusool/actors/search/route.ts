import { z } from "zod";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import { ActorSource, ActorType } from "@/features/actors/domain/actor.types";
import { resolveEnvironment } from "@/infrastructure/server/environmentResolver";
import { serverRequest } from "@/infrastructure/server/wusoolServerClient";
import { fail, ok } from "../../helpers";
import { actorTypeSchema, envInputSchema } from "../../schemas";

const searchSchema = z.object({
  env: envInputSchema,
  adminToken: z.string().optional(),
  types: z.array(actorTypeSchema).min(1),
});

function busToActor(raw: {
  id: number | string;
  plateNumber?: string;
  brand?: string;
  model?: string;
  capacity?: number;
}): ActorRef {
  return {
    id: String(raw.id),
    type: ActorType.Bus,
    label: raw.plateNumber || `Bus ${raw.id}`,
    sublabel: [
      raw.brand,
      raw.model,
      raw.capacity ? `${raw.capacity} seats` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    authenticated: false,
    source: ActorSource.Existing,
    raw: raw as unknown as Record<string, unknown>,
  };
}

function userToActor(raw: {
  id?: number | string;
  userId?: number | string;
  sub?: string;
  role?: string;
  roles?: string[];
  fullName?: string;
  displayName?: string;
  name?: string;
  email?: string;
}): ActorRef | null {
  const role = String(raw.role || raw.roles?.[0] || "").toLowerCase();
  const isDriver = role.includes("driver");
  const type: ActorType = isDriver ? ActorType.Driver : ActorType.Passenger;
  const name =
    raw.fullName ||
    raw.displayName ||
    raw.name ||
    raw.email ||
    `User ${raw.id}`;
  return {
    id: String(raw.id ?? raw.userId ?? raw.sub),
    type,
    label: name,
    sublabel: raw.email || (isDriver ? "Driver" : "Passenger"),
    authenticated: false,
    source: ActorSource.Existing,
    raw: raw as unknown as Record<string, unknown>,
  };
}

/** Discover existing actors (buses from /buses, users from /admin/users). */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = searchSchema.parse(await request.json());
    const env = await resolveEnvironment(body.env);
    const out: ActorRef[] = [];

    if (body.types.includes(ActorType.Bus)) {
      const buses = await serverRequest(env, "/api/v1/buses", {
        token: body.adminToken,
        params: { pageSize: 100 },
      });
      const items = (buses.data as { items?: unknown[] } | null)?.items ?? [];
      for (const b of items)
        out.push(busToActor(b as Parameters<typeof busToActor>[0]));
    }

    if (
      body.types.includes(ActorType.Passenger) ||
      body.types.includes(ActorType.Driver)
    ) {
      const users = await serverRequest(env, "/api/v1/admin/users", {
        token: body.adminToken,
        params: { pageSize: 100 },
      });
      const items = (users.data as { items?: unknown[] } | null)?.items ?? [];
      for (const u of items) {
        const actor = userToActor(u as Parameters<typeof userToActor>[0]);
        if (actor && body.types.includes(actor.type)) out.push(actor);
      }
    }

    return ok(out);
  } catch (err) {
    return fail(err);
  }
}
