import { z } from "zod";
import type {
  ActionCategory,
  ActionDef,
  ActionField,
  ActionSummary,
  ActionTransport,
} from "@/features/actions/domain/action.types";
import {
  ActionCategory as AC,
  EntityKind as EK,
  type EntityKind,
} from "@/features/actions/domain/action.types";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import { ActorType } from "@/features/actors/domain/actor.types";

type Args = Record<string, unknown>;
type ActionArgs = Record<string, unknown>;

/** Helper to define a transport without repeating the default `from/to`. */
function t(
  method: ActionTransport["method"],
  path: string,
  opts: {
    query?: Array<{ from: string; to?: string }>;
    body?: Array<{ from: string; to?: string }>;
    dynamic?: Record<string, string>;
  } = {},
): ActionTransport {
  return {
    method,
    path,
    queryParams: opts.query?.map((p) => ({ from: p.from, to: p.to ?? p.from })),
    bodyParams: opts.body?.map((p) => ({ from: p.from, to: p.to ?? p.from })),
    dynamic: opts.dynamic,
  };
}

export const actions: ActionDef[] = [
  // ---------- Passenger (verified first slice) ----------
  {
    metadata: {
      id: "passenger.hail",
      verified: true,
      contractRef: "passenger.hail",
      labelKey: "actions.passenger.hail",
      category: AC.Booking,
      actorTypes: [ActorType.Passenger],
      requiresAuth: true,
      summaryKey: "actions.passenger.hail.summary",
      fields: [
        {
          id: "startStopId",
          kind: "entity",
          entity: EK.Stop,
          labelKey: "fields.startStop",
          required: true,
        },
        {
          id: "endStopId",
          kind: "entity",
          entity: EK.Stop,
          labelKey: "fields.endStop",
          required: true,
        },
      ],
    },
    transport: t("POST", "/api/v1/user-trips", {
      body: [{ from: "startStopId" }, { from: "endStopId" }],
    }),
  },
  {
    metadata: {
      id: "passenger.reserve",
      verified: true,
      contractRef: "passenger.reserve",
      labelKey: "actions.passenger.reserve",
      category: AC.Booking,
      actorTypes: [ActorType.Passenger],
      requiresAuth: true,
      summaryKey: "actions.passenger.reserve.summary",
      refreshEntityKinds: [EK.Trip, EK.Stop],
      fields: [
        {
          id: "busTripId",
          kind: "entity",
          entity: EK.Trip,
          labelKey: "fields.trip",
          required: true,
        },
        {
          id: "boardingStopId",
          kind: "entity",
          entity: EK.Stop,
          labelKey: "fields.boardingStop",
          required: true,
        },
        {
          id: "alightingStopId",
          kind: "entity",
          entity: EK.Stop,
          labelKey: "fields.alightingStop",
          required: true,
        },
      ],
    },
    transport: t("POST", "/api/v1/user-trips/reserve", {
      body: [
        { from: "busTripId" },
        { from: "boardingStopId" },
        { from: "alightingStopId" },
      ],
    }),
  },
  {
    metadata: {
      id: "passenger.myBookings",
      verified: true,
      contractRef: "passenger.myBookings",
      labelKey: "actions.passenger.myBookings",
      category: AC.Booking,
      actorTypes: [ActorType.Passenger],
      requiresAuth: true,
      summaryKey: "actions.passenger.myBookings.summary",
      refreshEntityKinds: [EK.Booking],
      fields: [],
    },
    transport: t("GET", "/api/v1/user-trips/me"),
  },
  {
    metadata: {
      id: "passenger.cancelBooking",
      verified: true,
      contractRef: "passenger.cancelBooking",
      labelKey: "actions.passenger.cancelBooking",
      category: AC.Booking,
      actorTypes: [ActorType.Passenger],
      requiresAuth: true,
      summaryKey: "actions.passenger.cancelBooking.summary",
      refreshEntityKinds: [EK.Booking],
      fields: [
        {
          id: "id",
          kind: "entity",
          entity: EK.Booking,
          labelKey: "fields.booking",
          required: true,
        },
        { id: "reason", kind: "text", labelKey: "fields.reason" },
      ],
    },
    transport: t("POST", "/api/v1/user-trips/{id}/cancel", {
      body: [{ from: "reason" }],
    }),
  },
  {
    metadata: {
      id: "passenger.rateTrip",
      verified: true,
      contractRef: "passenger.rateTrip",
      labelKey: "actions.passenger.rateTrip",
      category: AC.Booking,
      actorTypes: [ActorType.Passenger],
      requiresAuth: true,
      summaryKey: "actions.passenger.rateTrip.summary",
      refreshEntityKinds: [EK.Booking],
      fields: [
        {
          id: "id",
          kind: "entity",
          entity: EK.Booking,
          labelKey: "fields.booking",
          required: true,
        },
        {
          id: "score",
          kind: "select",
          labelKey: "fields.score",
          required: true,
          options: ["1", "2", "3", "4", "5"].map((v) => ({
            value: v,
            label: v,
          })),
        },
        { id: "comment", kind: "text", labelKey: "fields.comment" },
      ],
    },
    transport: t("POST", "/api/v1/user-trips/{id}/rating", {
      body: [{ from: "score" }, { from: "comment" }],
    }),
  },
  {
    metadata: {
      id: "passenger.discoverTrips",
      verified: true,
      contractRef: "passenger.discoverTrips",
      labelKey: "actions.passenger.discoverTrips",
      category: AC.Trip,
      actorTypes: [ActorType.Passenger],
      requiresAuth: false,
      summaryKey: "actions.passenger.discoverTrips.summary",
      refreshEntityKinds: [EK.Route, EK.Stop, EK.Trip],
      fields: [
        {
          id: "routeId",
          kind: "entity",
          entity: EK.Route,
          labelKey: "fields.route",
        },
        {
          id: "fromStopId",
          kind: "entity",
          entity: EK.Stop,
          labelKey: "fields.fromStop",
        },
      ],
    },
    transport: t("GET", "/api/v1/bus-trips", {
      query: [
        { from: "routeId", to: "RouteId" },
        { from: "fromStopId", to: "FromStopId" },
      ],
    }),
  },
  // ---------- Driver (unverified extension point) ----------
  {
    metadata: {
      id: "driver.startTrip",
      verified: false,
      contractRef: "driver.startTrip",
      labelKey: "actions.driver.startTrip",
      category: AC.Trip,
      actorTypes: [ActorType.Driver],
      requiresAuth: true,
      summaryKey: "actions.driver.startTrip.summary",
      fields: [
        {
          id: "id",
          kind: "entity",
          entity: EK.Trip,
          labelKey: "fields.trip",
          required: true,
        },
      ],
    },
    transport: t("POST", "/api/v1/bus-trips/{id}/start"),
  },
  {
    metadata: {
      id: "driver.endTrip",
      verified: false,
      contractRef: "driver.endTrip",
      labelKey: "actions.driver.endTrip",
      category: AC.Trip,
      actorTypes: [ActorType.Driver],
      requiresAuth: true,
      summaryKey: "actions.driver.endTrip.summary",
      fields: [
        {
          id: "id",
          kind: "entity",
          entity: EK.Trip,
          labelKey: "fields.trip",
          required: true,
        },
      ],
    },
    transport: t("POST", "/api/v1/bus-trips/{id}/end"),
  },
  {
    metadata: {
      id: "driver.reportIncident",
      verified: false,
      contractRef: "driver.reportIncident",
      labelKey: "actions.driver.reportIncident",
      category: AC.Incident,
      actorTypes: [ActorType.Driver],
      requiresAuth: true,
      summaryKey: "actions.driver.reportIncident.summary",
      fields: [
        {
          id: "incidentType",
          kind: "text",
          labelKey: "fields.incidentType",
          required: true,
        },
        {
          id: "severity",
          kind: "select",
          labelKey: "fields.severity",
          options: ["Low", "Moderate", "High", "Critical"].map((v) => ({
            value: v,
            label: v,
          })),
        },
        {
          id: "busId",
          kind: "entity",
          entity: EK.Bus,
          labelKey: "fields.bus",
        },
        {
          id: "description",
          kind: "textarea",
          labelKey: "fields.description",
          required: true,
        },
        {
          id: "locationDescription",
          kind: "text",
          labelKey: "fields.location",
        },
      ],
    },
    transport: t("POST", "/api/v1/incidents", {
      body: [
        { from: "incidentType" },
        { from: "severity" },
        { from: "busId" },
        { from: "description" },
        { from: "locationDescription" },
      ],
    }),
  },
  {
    metadata: {
      id: "driver.myIncidents",
      verified: false,
      contractRef: "driver.myIncidents",
      labelKey: "actions.driver.myIncidents",
      category: AC.Incident,
      actorTypes: [ActorType.Driver],
      requiresAuth: true,
      summaryKey: "actions.driver.myIncidents.summary",
      fields: [],
    },
    transport: t("GET", "/api/v1/incidents/me"),
  },
  {
    metadata: {
      id: "driver.myShifts",
      verified: false,
      contractRef: "driver.myShifts",
      labelKey: "actions.driver.myShifts",
      category: AC.Shift,
      actorTypes: [ActorType.Driver],
      requiresAuth: true,
      summaryKey: "actions.driver.myShifts.summary",
      fields: [],
    },
    transport: t("GET", "/api/v1/shifts/me"),
  },
  {
    metadata: {
      id: "driver.checkIn",
      verified: false,
      contractRef: "driver.checkIn",
      labelKey: "actions.driver.checkIn",
      category: AC.Shift,
      actorTypes: [ActorType.Driver],
      requiresAuth: true,
      summaryKey: "actions.driver.checkIn.summary",
      fields: [
        {
          id: "id",
          kind: "entity",
          entity: EK.Shift,
          labelKey: "fields.shift",
          required: true,
        },
      ],
    },
    transport: t("POST", "/api/v1/shifts/me/{id}/start"),
  },
  {
    metadata: {
      id: "driver.myBus",
      verified: false,
      contractRef: "driver.myBus",
      labelKey: "actions.driver.myBus",
      category: AC.General,
      actorTypes: [ActorType.Driver],
      requiresAuth: true,
      summaryKey: "actions.driver.myBus.summary",
      fields: [],
    },
    transport: t("GET", "/api/v1/buses/by-driver/{driverId}", {
      dynamic: { driverId: "internal.id" },
    }),
  },

  // ---------- Bus (unverified extension point) ----------
  {
    metadata: {
      id: "bus.location",
      verified: false,
      contractRef: "bus.location",
      labelKey: "actions.bus.location",
      category: AC.Location,
      actorTypes: [ActorType.Bus],
      requiresAuth: false,
      summaryKey: "actions.bus.location.summary",
      fields: [],
    },
    transport: t("GET", "/api/v1/buses/{id}/location", {
      dynamic: { id: "internal.id" },
    }),
  },
  {
    metadata: {
      id: "bus.detail",
      verified: false,
      contractRef: "bus.detail",
      labelKey: "actions.bus.detail",
      category: AC.General,
      actorTypes: [ActorType.Bus],
      requiresAuth: false,
      summaryKey: "actions.bus.detail.summary",
      fields: [],
    },
    transport: t("GET", "/api/v1/buses/{id}", {
      dynamic: { id: "internal.id" },
    }),
  },
  {
    metadata: {
      id: "general.listBuses",
      verified: true,
      contractRef: "general.listBuses",
      labelKey: "actions.bus.list",
      category: AC.General,
      actorTypes: [ActorType.Passenger, ActorType.Driver, ActorType.Bus],
      requiresAuth: false,
      summaryKey: "actions.bus.list.summary",
      fields: [],
    },
    transport: t("GET", "/api/v1/buses"),
  },
  {
    metadata: {
      id: "general.listRoutes",
      verified: true,
      contractRef: "general.listRoutes",
      labelKey: "actions.general.listRoutes",
      category: AC.General,
      actorTypes: [ActorType.Passenger, ActorType.Driver, ActorType.Bus],
      requiresAuth: false,
      summaryKey: "actions.general.listRoutes.summary",
      fields: [],
    },
    transport: t("GET", "/api/v1/routes"),
  },
  {
    metadata: {
      id: "general.listStops",
      verified: true,
      contractRef: "general.listStops",
      labelKey: "actions.general.listStops",
      category: AC.General,
      actorTypes: [ActorType.Passenger, ActorType.Driver, ActorType.Bus],
      requiresAuth: false,
      summaryKey: "actions.general.listStops.summary",
      fields: [],
    },
    transport: t("GET", "/api/v1/stops"),
  },
];

/** Lookup index — the validated action registry. */
const registry: Record<string, ActionDef> = Object.fromEntries(
  actions.map((a) => [a.metadata.id, a]),
);

/** Registry extension point: registering an action is adding an entry above. */
export function getAction(id: string): ActionDef | undefined {
  return registry[id];
}

export function actionsForActor(
  type: ActorType,
  category?: ActionCategory,
): ActionDef[] {
  return actions.filter(
    (a) =>
      a.metadata.actorTypes.includes(type) &&
      (category == null || a.metadata.category === category),
  );
}

/** Actions for an actor that map to contract-verified Wusool endpoints.
 *  Unverified (Driver/Bus + unconfirmed) actions are never listable/executable. */
export function verifiedActionsForActor(
  type: ActorType,
  category?: ActionCategory,
): ActionDef[] {
  return actionsForActor(type, category).filter((a) => a.metadata.verified);
}

/** Supporting entity kinds whose fresh state is required before execution. */
export function refreshDependencies(action: ActionDef): EntityKind[] {
  return action.metadata.refreshEntityKinds ?? [];
}

// ---------------------------------------------------------------- validation

function fieldSchema(f: ActionField): z.ZodString | z.ZodOptional<z.ZodString> {
  const required = f.required === true && f.defaultValue == null;
  const base = required
    ? z.string().min(1, { message: "fields.required" })
    : z.string();
  return required ? base : base.optional();
}

/** Per-action Zod schema derived from metadata fields. Used by both the BFF
 *  (authoritative) and presentation (inline feedback). */
export function actionSchema(
  action: ActionDef,
): z.ZodObject<Record<string, z.ZodType>> {
  const shape: Record<string, z.ZodType> = {};
  for (const f of action.metadata.fields) {
    shape[f.id] = fieldSchema(f);
  }
  return z.object(shape);
}

export type ValidationResult =
  | { ok: true; args: ActionArgs }
  | { ok: false; errors: Record<string, string> };

/** Validate user inputs for an action. Normal mode enforces required fields;
 *  advanced invalid-test mode deliberately skips this without affecting the
 *  normal path. Returns structured field errors keyed for i18n. */
export function validateActionArgs(
  action: ActionDef,
  args: ActionArgs,
): ValidationResult {
  const parsed = actionSchema(action).safeParse(args ?? {});
  if (parsed.success) return { ok: true, args: parsed.data };

  return {
    ok: false,
    errors: parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
      const field = issue.path[0] as string | undefined;
      const messageKey =
        issue.code === "invalid_type" || issue.code === "too_small"
          ? "fields.required"
          : "fields.invalid";
      if (field && acc[field] == null) acc[field] = messageKey;
      return acc;
    }, {}),
  };
}

// ------------------------------------------------------------- transport map

function resolveSource(expr: string, args: Args, actor: ActorRef): unknown {
  const src = expr.split(".");
  if (src[0] === "internal") {
    let cur: unknown = actor.raw;
    for (let i = 1; i < src.length; i++) {
      cur = (cur as Record<string, unknown> | undefined)?.[src[i]];
    }
    return cur;
  }
  return args[expr];
}

function setDynamic(
  targets: Record<string, string>,
  out: Record<string, unknown>,
  args: Args,
  actor: ActorRef,
): void {
  for (const [target, expr] of Object.entries(targets)) {
    const v = resolveSource(expr, args, actor);
    if (v != null && out[target] == null) out[target] = v;
  }
}

/** Build the effective request body from explicit bodyParams + dynamic mapping.
 *  Selector/id fields are only included when the contract puts them in the body. */
export function buildBody(
  action: ActionDef,
  args: Args,
  actor: ActorRef,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const p of action.transport.bodyParams ?? []) {
    const v = args[p.from];
    if (v != null && String(v) !== "") body[p.to] = v;
  }
  if (action.transport.dynamic)
    setDynamic(action.transport.dynamic, body, args, actor);
  return body;
}

/** Substitute path placeholders from args or internal.* dynamic sources. */
export function buildPath(
  action: ActionDef,
  args: Args,
  actor: ActorRef,
): string {
  return action.transport.path.replace(
    /\{([a-zA-Z]+)\}/g,
    (_m, name: string) => {
      const dyn = action.transport.dynamic?.[name];
      const v = dyn != null ? resolveSource(dyn, args, actor) : args[name];
      return v != null && String(v) !== "" ? String(v) : _m;
    },
  );
}

/** Build query params from explicit queryParams (backend parameter names). */
export function buildQuery(
  action: ActionDef,
  args: Args,
): Record<string, string> | undefined {
  const q: Record<string, string> = {};
  for (const p of action.transport.queryParams ?? []) {
    const v = args[p.from];
    if (v != null && String(v) !== "") q[p.to] = String(v);
  }
  return Object.keys(q).length ? q : undefined;
}

// ---------------------------------------------------------------- summaries

/** Dereference a human-readable success result from response data. */
function entityId(data: unknown): string | undefined {
  if (data == null) return undefined;
  const id = (data as Record<string, unknown>).id;
  if (id != null) return String(id);
  const singleId = (data as Record<string, unknown>).userTripId;
  return singleId != null ? String(singleId) : undefined;
}

/* Per-action human-readable summary builders. Each returns an i18n key + params
 * for a readable, actor-scoped one-liner such as “Passenger #42 booked Trip #184”. */
const SUMMARIES: Record<
  string,
  (ctx: { actorLabel: string; args: Args; data: unknown }) => ActionSummary
> = {
  "passenger.reserve": ({ actorLabel, args, data }) => ({
    key: "result.passenger.reserved",
    params: {
      actor: actorLabel,
      trip: entityId(data) ?? String(args.busTripId ?? ""),
    },
  }),
  "passenger.cancelBooking": ({ actorLabel, args }) => ({
    key: "result.passenger.cancelled",
    params: { actor: actorLabel, booking: String(args.id ?? "") },
  }),
  "passenger.myBookings": ({ actorLabel }) => ({
    key: "result.passenger.listed",
    params: { actor: actorLabel },
  }),
  "passenger.discoverTrips": ({ actorLabel }) => ({
    key: "result.passenger.discovered",
    params: { actor: actorLabel },
  }),
  "passenger.hail": ({ actorLabel, data, args }) => ({
    key: "result.passenger.hailed",
    params: {
      actor: actorLabel,
      trip: entityId(data) ?? String(args.startStopId ?? ""),
    },
  }),
  "passenger.rateTrip": ({ actorLabel }) => ({
    key: "result.passenger.rated",
    params: { actor: actorLabel },
  }),
};

export interface SummaryContext {
  actorLabel: string;
  args: Args;
  data?: unknown;
  ok: boolean;
  needsAuth: boolean;
}

/** Produce the human-readable result for an execution, falling back to the
 *  action's static summary key when no custom summarizer exists. */
export function summarizeAction(
  action: ActionDef,
  ctx: SummaryContext,
): ActionSummary {
  if (ctx.needsAuth) return { key: "action.authRequired" };
  if (!ctx.ok)
    return { key: "result.actionFailed", params: { actor: ctx.actorLabel } };
  const summarizer = SUMMARIES[action.metadata.id];
  if (summarizer)
    return summarizer({
      actorLabel: ctx.actorLabel,
      args: ctx.args,
      data: ctx.data,
    });
  return { key: action.metadata.summaryKey };
}
