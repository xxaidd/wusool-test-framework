import type { EntityKind } from "@/features/actions/domain/action.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { apiRequest } from "@/infrastructure/http/WusoolApiClient";

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

export async function loadEntity(
  env: BackendEnvironment,
  token: string | undefined,
  kind: EntityKind,
  query: string,
): Promise<EntityOption[]> {
  const params: Record<string, string | number | boolean> = {
    pageSize: 25,
    ...(query ? { search: query, SearchTerm: query } : {}),
  };

  if (kind === "route") {
    const data = (await apiRequest(env, "/api/v1/routes", {
      token,
      params,
    })) as { items?: Nameful[] };
    return (data?.items ?? []).map((r) => ({
      value: String(r.id),
      label: r.shortName || r.name?.en || r.name?.ar || `Route ${r.id}`,
      raw: r as unknown as Record<string, unknown>,
    }));
  }
  if (kind === "stop") {
    const data = (await apiRequest(env, "/api/v1/stops", {
      token,
      params,
    })) as { items?: Nameful[] };
    return (data?.items ?? []).map((s) => ({
      value: String(s.id),
      label: s.name?.en || s.name?.ar || `Stop ${s.id}`,
      raw: s as unknown as Record<string, unknown>,
    }));
  }
  if (kind === "trip") {
    const data = (await apiRequest(env, "/api/v1/bus-trips", {
      token,
      params,
    })) as { items?: Nameful[] };
    return (data?.items ?? []).map((t) => ({
      value: String(t.id),
      label: `${t.routeName?.en || t.routeName?.ar || "Trip"} · ${t.departureTime ?? t.id}`,
      raw: t as unknown as Record<string, unknown>,
    }));
  }
  if (kind === "bus") {
    const data = (await apiRequest(env, "/api/v1/buses", {
      token,
      params,
    })) as { items?: Nameful[] };
    return (data?.items ?? []).map((b) => ({
      value: String(b.id),
      label: b.plateNumber || `Bus ${b.id}`,
      raw: b as unknown as Record<string, unknown>,
    }));
  }
  if (kind === "booking") {
    const data = (await apiRequest(env, "/api/v1/user-trips/me", {
      token,
      params,
    })) as { items?: Nameful[] };
    return (data?.items ?? []).map((t) => ({
      value: String(t.id),
      label: `${t.boardingStopName?.en || t.boardingStopName?.ar || "Trip"} → ${t.alightingStopName?.en || t.alightingStopName?.ar || t.id} · ${t.status ?? ""}`,
      raw: t as unknown as Record<string, unknown>,
    }));
  }
  if (kind === "shift") {
    const data = (await apiRequest(env, "/api/v1/shifts/me", {
      token,
      params,
    })) as { items?: Nameful[] };
    return (data?.items ?? []).map((s) => ({
      value: String(s.id),
      label: `${s.shiftDate ?? ""} · ${s.shiftType ?? ""} · ${s.status ?? s.id}`,
      raw: s as unknown as Record<string, unknown>,
    }));
  }
  return [];
}
