import { z } from "zod";
import type { EntityKind } from "@/features/actions/domain/action.types";
import {
  bookingMapper,
  busMapper,
  type MappedEntityOption,
  routeMapper,
  shiftMapper,
  stopMapper,
  tripMapper,
} from "@/infrastructure/contracts/mappers";
import { BusDtoSchema } from "@/infrastructure/contracts/schemas/actor";
import {
  BookableTripDtoSchema,
  DriverShiftDtoSchema,
  PagedEnvelopeSchema,
  RouteResponseSchema,
  StopDtoSchema,
  UserTripDtoSchema,
} from "@/infrastructure/contracts/schemas/entity";
import { getDevCredentialVault } from "@/infrastructure/server/credentialVaultDev";
import { resolveEnvironment } from "@/infrastructure/server/environmentResolver";
import {
  ServerApiError,
  serverRequest,
} from "@/infrastructure/server/wusoolServerClient";
import { fail, ok } from "../../helpers";
import { envInputSchema } from "../../schemas";

/** Kinds that must run under the selected actor's identity, never the framework identity. */
const AUTH_GATED_KINDS = new Set<string>(["trip", "booking", "shift"]);

const searchSchema = z.object({
  env: envInputSchema,
  actorId: z.string().optional(),
  kind: z.enum(["route", "stop", "trip", "bus", "booking", "shift"]),
  page: z.number().int().positive().default(1),
  pageSize: z
    .number()
    .int()
    .positive()
    .default(25)
    // Oversized values are clamped to the backend cap, not rejected.
    .transform((v) => Math.min(v, SEARCH_PAGE_SIZE_MAX)),
});

/** Allow oversized pageSize by clamping to the backend cap instead of rejecting. */
export const SEARCH_PAGE_SIZE_MAX = 50;

/**
 * Parse and map backend items through the contract DTO schemas and mappers.
 * Items that fail validation are skipped — never mapped by guessing.
 */
function mapItems(kind: string, items: unknown[]): MappedEntityOption[] {
  const options: MappedEntityOption[] = [];
  for (const item of items) {
    let mapped: MappedEntityOption | undefined;
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
        const b = busMapper(parsed.data);
        mapped = { value: b.id, label: b.label, raw: b.raw };
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
    const kind = body.kind as EntityKind;
    const pageSize = Math.min(body.pageSize, 50);

    // Auth-gated kinds (trip/booking/shift) require the selected actor's own
    // token. If absent, ask the client to authenticate that actor — never use
    // a framework/admin identity for actor-authenticated data.
    const requiresToken = AUTH_GATED_KINDS.has(kind);
    let token: string | undefined;
    if (requiresToken) {
      if (!body.actorId) {
        return ok({
          items: [],
          page: 1,
          pageSize,
          total: 0,
          hasMore: false,
          needsAuth: true,
        });
      }
      const ctx = await getDevCredentialVault().resolve(body.actorId, env.id);
      token = ctx?.accessToken;
      if (!token) {
        return ok({
          items: [],
          page: 1,
          pageSize,
          total: 0,
          hasMore: false,
          needsAuth: true,
        });
      }
    } else if (body.actorId) {
      const ctx = await getDevCredentialVault().resolve(body.actorId, env.id);
      token = ctx?.accessToken;
    }

    let path = "";
    const params: Record<string, string | number> = {
      PageNumber: body.page,
      PageSize: pageSize,
    };
    if (kind === "route") path = "/api/v1/routes";
    else if (kind === "stop") path = "/api/v1/stops";
    else if (kind === "trip") path = "/api/v1/bus-trips";
    else if (kind === "bus") path = "/api/v1/buses";
    else if (kind === "booking") path = "/api/v1/user-trips/me";
    else if (kind === "shift") path = "/api/v1/shifts/me";

    const res = await serverRequest(env, path, { token, params });

    // The server client unwraps `ApiResponse` → `{ items, pagination }`.
    const parsed = PagedEnvelopeSchema.safeParse(res.data);
    if (!parsed.success) {
      throw new ServerApiError(
        502,
        "Malformed paged response from backend.",
        "BACKEND",
      );
    }
    const rawItems = parsed.data.items ?? [];
    const pagination = parsed.data.pagination;
    const total = pagination?.totalCount ?? rawItems.length;
    const page = pagination?.currentPage ?? body.page;
    const hasMore =
      pagination?.hasNextPage ??
      (pagination?.totalPages != null
        ? page < pagination.totalPages
        : page * pageSize < total);

    const items = mapItems(body.kind, rawItems).map((m) => ({
      value: m.value,
      label: m.label,
      ...(m.meta ? { meta: m.meta } : {}),
    }));

    return ok({ items, page, pageSize, total, hasMore });
  } catch (err) {
    return fail(err);
  }
}
