import { z } from "zod";
import type { EntityKind } from "@/features/actions/domain/action.types";
import {
  bookingMapper,
  busMapper,
  routeMapper,
  shiftMapper,
  stopMapper,
  tripMapper,
} from "@/infrastructure/contracts/mappers";
import { BusDtoSchema } from "@/infrastructure/contracts/schemas/actor";
import {
  BookableTripDtoSchema,
  DriverShiftDtoSchema,
  RouteResponseSchema,
  StopDtoSchema,
  UserTripDtoSchema,
} from "@/infrastructure/contracts/schemas/entity";
import { getDevCredentialVault } from "@/infrastructure/server/credentialVaultDev";
import { resolveEnvironment } from "@/infrastructure/server/environmentResolver";
import { serverRequest } from "@/infrastructure/server/wusoolServerClient";
import { fail, ok } from "../../helpers";
import { envInputSchema } from "../../schemas";

export interface EntityOption {
  value: string;
  label: string;
  raw?: Record<string, unknown>;
}

const searchSchema = z.object({
  env: envInputSchema,
  actorId: z.string().optional(),
  kind: z.enum(["route", "stop", "trip", "bus", "booking", "shift"]),
  query: z.string().default(""),
});

/**
 * Parse and map backend items through the contract DTO schemas and mappers.
 * Items that fail validation are skipped — never mapped by guessing.
 */
function mapItems(kind: string, items: unknown[]): EntityOption[] {
  const options: EntityOption[] = [];
  for (const item of items) {
    let mapped: EntityOption | undefined;
    if (kind === "stop") {
      const parsed = StopDtoSchema.safeParse(item);
      if (parsed.success) mapped = stopMapper(parsed.data);
    } else if (kind === "route") {
      const parsed = RouteResponseSchema.safeParse(item);
      if (parsed.success) mapped = routeMapper(parsed.data);
    } else if (kind === "trip") {
      const parsed = BookableTripDtoSchema.safeParse(item);
      if (parsed.success) mapped = tripMapper(parsed.data);
    } else if (kind === "bus") {
      const parsed = BusDtoSchema.safeParse(item);
      if (parsed.success) {
        const mapped = busMapper(parsed.data);
        options.push({
          value: mapped.id,
          label: mapped.label,
          raw: mapped.raw,
        });
      }
    } else if (kind === "booking") {
      const parsed = UserTripDtoSchema.safeParse(item);
      if (parsed.success) mapped = bookingMapper(parsed.data);
    } else if (kind === "shift") {
      const parsed = DriverShiftDtoSchema.safeParse(item);
      if (parsed.success) mapped = shiftMapper(parsed.data);
    }
    if (mapped) options.push(mapped);
  }
  return options;
}

/** Search backend entities for action form fields, resolving actor auth server-side. */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = searchSchema.parse(await request.json());
    const env = await resolveEnvironment(body.env);

    let token: string | undefined;
    if (body.actorId) {
      const ctx = await getDevCredentialVault().resolve(body.actorId, env.id);
      token = ctx?.accessToken;
    }

    const params: Record<string, string | number | boolean> = {
      pageSize: 25,
      ...(body.query ? { search: body.query, SearchTerm: body.query } : {}),
    };

    const kind = body.kind as EntityKind;
    let path = "";
    if (kind === "route") path = "/api/v1/routes";
    else if (kind === "stop") path = "/api/v1/stops";
    else if (kind === "trip") path = "/api/v1/bus-trips";
    else if (kind === "bus") path = "/api/v1/buses";
    else if (kind === "booking") path = "/api/v1/user-trips/me";
    else if (kind === "shift") path = "/api/v1/shifts/me";

    const res = await serverRequest(env, path, { token, params });
    const items = (res.data as { items?: unknown[] } | null)?.items ?? [];

    return ok(mapItems(body.kind, items));
  } catch (err) {
    return fail(err);
  }
}
