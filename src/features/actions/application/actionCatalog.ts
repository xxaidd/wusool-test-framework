import type {
  ActionCategory,
  ActionDef,
} from "@/features/actions/domain/action.types";
import {
  ActionCategory as AC,
  EntityKind as EK,
} from "@/features/actions/domain/action.types";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import { ActorType } from "@/features/actors/domain/actor.types";

export const actions: ActionDef[] = [
  // ---------- Passenger ----------
  {
    id: "passenger.hail",
    labelKey: "actions.passenger.hail",
    category: AC.Booking,
    actorTypes: [ActorType.Passenger],
    method: "POST",
    path: "/api/v1/user-trips",
    requiresAuth: true,
    summaryKey: "actions.passenger.hail.summary",
    fields: [
      {
        id: "startStopId",
        kind: "entity",
        entity: EK.Stop,
        labelKey: "fields.startStop",
      },
      {
        id: "endStopId",
        kind: "entity",
        entity: EK.Stop,
        labelKey: "fields.endStop",
      },
    ],
  },
  {
    id: "passenger.reserve",
    labelKey: "actions.passenger.reserve",
    category: AC.Booking,
    actorTypes: [ActorType.Passenger],
    method: "POST",
    path: "/api/v1/user-trips/reserve",
    requiresAuth: true,
    summaryKey: "actions.passenger.reserve.summary",
    fields: [
      {
        id: "busTripId",
        kind: "entity",
        entity: EK.Trip,
        labelKey: "fields.trip",
      },
      {
        id: "boardingStopId",
        kind: "entity",
        entity: EK.Stop,
        labelKey: "fields.boardingStop",
      },
      {
        id: "alightingStopId",
        kind: "entity",
        entity: EK.Stop,
        labelKey: "fields.alightingStop",
      },
    ],
  },
  {
    id: "passenger.myBookings",
    labelKey: "actions.passenger.myBookings",
    category: AC.Booking,
    actorTypes: [ActorType.Passenger],
    method: "GET",
    path: "/api/v1/user-trips/me",
    requiresAuth: true,
    summaryKey: "actions.passenger.myBookings.summary",
    fields: [],
  },
  {
    id: "passenger.cancelBooking",
    labelKey: "actions.passenger.cancelBooking",
    category: AC.Booking,
    actorTypes: [ActorType.Passenger],
    method: "POST",
    path: "/api/v1/user-trips/{id}/cancel",
    requiresAuth: true,
    summaryKey: "actions.passenger.cancelBooking.summary",
    fields: [
      {
        id: "id",
        kind: "entity",
        entity: EK.Booking,
        labelKey: "fields.booking",
      },
      {
        id: "reason",
        kind: "text",
        labelKey: "fields.reason",
        placeholder: "change of plans",
      },
    ],
  },
  {
    id: "passenger.rateTrip",
    labelKey: "actions.passenger.rateTrip",
    category: AC.Booking,
    actorTypes: [ActorType.Passenger],
    method: "POST",
    path: "/api/v1/user-trips/{id}/rating",
    requiresAuth: true,
    summaryKey: "actions.passenger.rateTrip.summary",
    fields: [
      {
        id: "id",
        kind: "entity",
        entity: EK.Booking,
        labelKey: "fields.booking",
      },
      {
        id: "score",
        kind: "select",
        labelKey: "fields.score",
        options: ["1", "2", "3", "4", "5"].map((v) => ({ value: v, label: v })),
      },
      { id: "comment", kind: "text", labelKey: "fields.comment" },
    ],
  },
  {
    id: "passenger.discoverTrips",
    labelKey: "actions.passenger.discoverTrips",
    category: AC.Trip,
    actorTypes: [ActorType.Passenger],
    method: "GET",
    path: "/api/v1/bus-trips",
    requiresAuth: false,
    summaryKey: "actions.passenger.discoverTrips.summary",
    fields: [
      {
        id: "routeId",
        kind: "entity",
        entity: EK.Route,
        labelKey: "fields.route",
        required: false,
      },
      {
        id: "fromStopId",
        kind: "entity",
        entity: EK.Stop,
        labelKey: "fields.fromStop",
        required: false,
      },
    ],
  },
  {
    id: "passenger.addFavorite",
    labelKey: "actions.passenger.addFavorite",
    category: AC.General,
    actorTypes: [ActorType.Passenger],
    method: "POST",
    path: "/api/v1/favorites",
    requiresAuth: true,
    summaryKey: "actions.passenger.addFavorite.summary",
    fields: [
      {
        id: "type",
        kind: "select",
        labelKey: "fields.favoriteType",
        options: [
          { value: "route", label: "Route" },
          { value: "stop", label: "Stop" },
        ],
      },
      {
        id: "targetId",
        kind: "entity",
        entity: EK.Stop,
        labelKey: "fields.target",
      },
    ],
    dynamic: { targetId: "type" },
  },

  // ---------- Driver ----------
  {
    id: "driver.startTrip",
    labelKey: "actions.driver.startTrip",
    category: AC.Trip,
    actorTypes: [ActorType.Driver],
    method: "POST",
    path: "/api/v1/bus-trips/{id}/start",
    requiresAuth: true,
    summaryKey: "actions.driver.startTrip.summary",
    fields: [
      { id: "id", kind: "entity", entity: EK.Trip, labelKey: "fields.trip" },
    ],
  },
  {
    id: "driver.endTrip",
    labelKey: "actions.driver.endTrip",
    category: AC.Trip,
    actorTypes: [ActorType.Driver],
    method: "POST",
    path: "/api/v1/bus-trips/{id}/end",
    requiresAuth: true,
    summaryKey: "actions.driver.endTrip.summary",
    fields: [
      { id: "id", kind: "entity", entity: EK.Trip, labelKey: "fields.trip" },
    ],
  },
  {
    id: "driver.reportIncident",
    labelKey: "actions.driver.reportIncident",
    category: AC.Incident,
    actorTypes: [ActorType.Driver],
    method: "POST",
    path: "/api/v1/incidents",
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
        required: false,
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
        required: false,
      },
    ],
  },
  {
    id: "driver.myIncidents",
    labelKey: "actions.driver.myIncidents",
    category: AC.Incident,
    actorTypes: [ActorType.Driver],
    method: "GET",
    path: "/api/v1/incidents/me",
    requiresAuth: true,
    summaryKey: "actions.driver.myIncidents.summary",
    fields: [],
  },
  {
    id: "driver.myShifts",
    labelKey: "actions.driver.myShifts",
    category: AC.Shift,
    actorTypes: [ActorType.Driver],
    method: "GET",
    path: "/api/v1/shifts/me",
    requiresAuth: true,
    summaryKey: "actions.driver.myShifts.summary",
    fields: [],
  },
  {
    id: "driver.checkIn",
    labelKey: "actions.driver.checkIn",
    category: AC.Shift,
    actorTypes: [ActorType.Driver],
    method: "POST",
    path: "/api/v1/shifts/me/{id}/start",
    requiresAuth: true,
    summaryKey: "actions.driver.checkIn.summary",
    fields: [
      { id: "id", kind: "entity", entity: EK.Shift, labelKey: "fields.shift" },
    ],
  },
  {
    id: "driver.myBus",
    labelKey: "actions.driver.myBus",
    category: AC.General,
    actorTypes: [ActorType.Driver],
    method: "GET",
    path: "/api/v1/buses/by-driver/{driverId}",
    requiresAuth: true,
    summaryKey: "actions.driver.myBus.summary",
    fields: [],
    dynamic: { driverId: "internal.id" },
  },

  // ---------- Bus ----------
  {
    id: "bus.location",
    labelKey: "actions.bus.location",
    category: AC.Location,
    actorTypes: [ActorType.Bus],
    method: "GET",
    path: "/api/v1/buses/{id}/location",
    requiresAuth: false,
    summaryKey: "actions.bus.location.summary",
    fields: [],
    dynamic: { id: "internal.id" },
  },
  {
    id: "bus.detail",
    labelKey: "actions.bus.detail",
    category: AC.General,
    actorTypes: [ActorType.Bus],
    method: "GET",
    path: "/api/v1/buses/{id}",
    requiresAuth: false,
    summaryKey: "actions.bus.detail.summary",
    fields: [],
    dynamic: { id: "internal.id" },
  },
  {
    id: "general.listBuses",
    labelKey: "actions.bus.list",
    category: AC.General,
    actorTypes: [ActorType.Passenger, ActorType.Driver, ActorType.Bus],
    method: "GET",
    path: "/api/v1/buses",
    requiresAuth: false,
    summaryKey: "actions.bus.list.summary",
    fields: [],
  },
  {
    id: "general.listRoutes",
    labelKey: "actions.general.listRoutes",
    category: AC.General,
    actorTypes: [ActorType.Passenger, ActorType.Driver, ActorType.Bus],
    method: "GET",
    path: "/api/v1/routes",
    requiresAuth: false,
    summaryKey: "actions.general.listRoutes.summary",
    fields: [],
  },
  {
    id: "general.listStops",
    labelKey: "actions.general.listStops",
    category: AC.General,
    actorTypes: [ActorType.Passenger, ActorType.Driver, ActorType.Bus],
    method: "GET",
    path: "/api/v1/stops",
    requiresAuth: false,
    summaryKey: "actions.general.listStops.summary",
    fields: [],
  },
];

export function actionsForActor(
  type: ActorType,
  category?: ActionCategory,
): ActionDef[] {
  return actions.filter(
    (a) =>
      a.actorTypes.includes(type) &&
      (category == null || a.category === category),
  );
}

export function getAction(id: string): ActionDef | undefined {
  return actions.find((a) => a.id === id);
}

/** Build the effective request body from field args + dynamic mappings + actor. */
export function buildBody(
  action: ActionDef,
  args: Record<string, unknown>,
  actor: ActorRef,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const f of action.fields) {
    if (f.kind === "entity" && args[f.id] != null) body[f.id] = args[f.id];
    else if (
      f.kind !== "entity" &&
      args[f.id] != null &&
      String(args[f.id]) !== ""
    )
      body[f.id] = args[f.id];
  }
  if (action.dynamic) {
    for (const [target, sourceExpr] of Object.entries(action.dynamic)) {
      const src = sourceExpr.split(".");
      let cur: unknown =
        src[0] === "internal"
          ? (actor.raw as Record<string, unknown>)
          : (args as Record<string, unknown>);
      for (let i = src[0] === "internal" ? 1 : 0; i < src.length; i++)
        cur = (cur as Record<string, unknown>)?.[src[i]];
      if (cur != null && body[target] == null) body[target] = cur;
    }
  }
  return body;
}

export function buildPath(
  action: ActionDef,
  args: Record<string, unknown>,
  actor: ActorRef,
): string {
  let path = action.path;
  path = path.replace(/\{([a-zA-Z]+)\}/g, (m, name) => {
    if (name === "driverId") {
      const id = (actor.raw as Record<string, unknown>)?.id ?? args.driverId;
      return id != null ? String(id) : m;
    }
    const v = args[name];
    return v != null ? String(v) : m;
  });
  return path;
}

export function buildQuery(
  action: ActionDef,
  args: Record<string, unknown>,
): Record<string, string> | undefined {
  const q: Record<string, string> = {};
  for (const f of action.fields) {
    if (f.kind === "entity" && args[f.id] != null) q[f.id] = String(args[f.id]);
  }
  for (const [k, v] of Object.entries(args) as Array<[string, unknown]>) {
    if (v != null && String(v) !== "" && !q[k]) q[k] = String(v);
  }
  return Object.keys(q).length ? q : undefined;
}
