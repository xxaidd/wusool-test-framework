import { z } from "zod";
import type { EntityKind } from "@/features/actions/domain/action.types";
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

interface Nameful {
  id?: number | string;
  name?: { en?: string; ar?: string };
  shortName?: string;
  plateNumber?: string;
  routeName?: { en?: string; ar?: string };
  departureTime?: string;
  boardingStopName?: { en?: string; ar?: string };
  alightingStopName?: { en?: string; ar?: string };
  status?: string;
  shiftDate?: string;
  shiftType?: string;
}

const searchSchema = z.object({
  env: envInputSchema,
  actorId: z.string().optional(),
  kind: z.enum(["route", "stop", "trip", "bus", "booking", "shift"]),
  query: z.string().default(""),
});

function toOptions(
  items: Nameful[],
  labelFor: (item: Nameful) => string,
): EntityOption[] {
  return items.map((item) => ({
    value: String(item.id),
    label: labelFor(item),
    raw: item as unknown as Record<string, unknown>,
  }));
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
    const items = (res.data as { items?: Nameful[] } | null)?.items ?? [];

    let options: EntityOption[] = [];
    if (kind === "route") {
      options = toOptions(
        items,
        (r) => r.shortName || r.name?.en || r.name?.ar || `Route ${r.id}`,
      );
    } else if (kind === "stop") {
      options = toOptions(
        items,
        (s) => s.name?.en || s.name?.ar || `Stop ${s.id}`,
      );
    } else if (kind === "trip") {
      options = toOptions(
        items,
        (t) =>
          `${t.routeName?.en || t.routeName?.ar || "Trip"} · ${t.departureTime ?? t.id}`,
      );
    } else if (kind === "bus") {
      options = toOptions(items, (b) => b.plateNumber || `Bus ${b.id}`);
    } else if (kind === "booking") {
      options = toOptions(
        items,
        (t) =>
          `${t.boardingStopName?.en || t.boardingStopName?.ar || "Trip"} → ${t.alightingStopName?.en || t.alightingStopName?.ar || t.id} · ${t.status ?? ""}`,
      );
    } else if (kind === "shift") {
      options = toOptions(
        items,
        (s) =>
          `${s.shiftDate ?? ""} · ${s.shiftType ?? ""} · ${s.status ?? s.id}`,
      );
    }

    return ok(options);
  } catch (err) {
    return fail(err);
  }
}
