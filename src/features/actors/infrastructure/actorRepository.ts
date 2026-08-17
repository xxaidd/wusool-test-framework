import type {
  ActorRef,
  CreateActorInput,
} from "@/features/actors/domain/actor.types";
import { ActorSource, ActorType } from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { apiRequest } from "@/infrastructure/http/WusoolApiClient";
import { registerPassenger } from "./authService";

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

/**
 * Discover existing actors from the backend. Buses come from /buses; users
 * (passengers + drivers) come from /admin/users. Requires an elevated token.
 */
export async function discoverActors(
  env: BackendEnvironment,
  adminToken: string,
  types: ActorType[],
): Promise<ActorRef[]> {
  const out: ActorRef[] = [];

  if (types.includes(ActorType.Bus)) {
    const buses = (await apiRequest(env, "/api/v1/buses", {
      token: adminToken,
      params: { pageSize: 100 },
    })) as { items?: unknown[] };
    for (const b of buses?.items ?? [])
      out.push(busToActor(b as Parameters<typeof busToActor>[0]));
  }

  if (types.includes(ActorType.Passenger) || types.includes(ActorType.Driver)) {
    const users = (await apiRequest(env, "/api/v1/admin/users", {
      token: adminToken,
      params: { pageSize: 100 },
    })) as { items?: unknown[] };
    for (const u of users?.items ?? []) {
      const actor = userToActor(u as Parameters<typeof userToActor>[0]);
      if (actor && types.includes(actor.type)) out.push(actor);
    }
  }

  return out;
}

export async function createActor(
  env: BackendEnvironment,
  adminToken: string,
  input: CreateActorInput,
): Promise<ActorRef> {
  if (input.type === ActorType.Passenger) {
    const email = input.email ?? "";
    const password = input.password ?? "";
    const { tokens, userId } = await registerPassenger(env, {
      email,
      password,
      fullName: input.name,
    });
    return {
      id: userId || String(Date.now()),
      type: ActorType.Passenger,
      label: input.name || email,
      sublabel: email,
      token: tokens.accessToken,
      authenticated: true,
      source: ActorSource.Test,
      raw: { email, userId },
    };
  }

  if (input.type === ActorType.Driver) {
    const data = (await apiRequest(env, "/api/v1/admin/drivers", {
      method: "POST",
      token: adminToken,
      data: {
        email: input.email ?? "",
        password: input.password ?? "",
        fullName: input.name,
      },
    })) as { driverId?: number | string; id?: number | string } | null;
    return {
      id: String(data?.driverId ?? data?.id ?? Date.now()),
      type: ActorType.Driver,
      label: input.name || (input.email ?? ""),
      sublabel: input.email ?? "",
      authenticated: false,
      source: ActorSource.Test,
      raw: (data as Record<string, unknown> | null) ?? { email: input.email },
    };
  }

  const data = (await apiRequest(env, "/api/v1/buses", {
    method: "POST",
    token: adminToken,
    data: { plateNumber: input.plateNumber, capacity: input.capacityNumber },
  })) as { id?: number | string } | null;
  return {
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
}
