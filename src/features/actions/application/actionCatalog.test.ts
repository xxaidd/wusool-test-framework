import { describe, expect, it } from "vitest";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import { ActorSource, ActorType } from "@/features/actors/domain/actor.types";
import type { ActionDef } from "../domain/action.types";
import { ActionCategory } from "../domain/action.types";
import {
  actionSchema,
  actionsForActor,
  buildBody,
  buildPath,
  buildQuery,
  getAction,
  summarizeAction,
  validateActionArgs,
  verifiedActionsForActor,
} from "./actionCatalog";

const actor: ActorRef = {
  id: "7",
  type: ActorType.Driver,
  label: "Driver 7",
  authenticated: false,
  source: ActorSource.Existing,
  raw: { id: 7, fullName: "Driver Seven" },
};

function mustGet(id: string): ActionDef {
  const action = getAction(id);
  if (!action) throw new Error(`missing action: ${id}`);
  return action;
}

describe("actionsForActor", () => {
  it("returns only actions for the actor type", () => {
    const driverActions = actionsForActor(ActorType.Driver);
    expect(driverActions.length).toBeGreaterThan(0);
    expect(
      driverActions.every((a) =>
        a.metadata.actorTypes.includes(ActorType.Driver),
      ),
    ).toBe(true);
  });

  it("filters by category", () => {
    const trip = actionsForActor(ActorType.Passenger, ActionCategory.Trip);
    expect(trip.every((a) => a.metadata.category === ActionCategory.Trip)).toBe(
      true,
    );
  });
});

describe("verified scope", () => {
  it("exposes the verified passenger first slice and no unverified passenger actions", () => {
    const ids = verifiedActionsForActor(ActorType.Passenger).map(
      (a) => a.metadata.id,
    );
    const slice = [
      "passenger.cancelBooking",
      "passenger.discoverTrips",
      "passenger.hail",
      "passenger.myBookings",
      "passenger.rateTrip",
      "passenger.reserve",
    ];
    expect(ids).toEqual(expect.arrayContaining(slice));
    expect(ids).not.toContain("passenger.addFavorite");
    // Every verified action is contract-backed (registration gate).
    for (const id of ids) {
      expect(getAction(id)?.metadata.contractRef, id).toBeTruthy();
    }
  });

  it("every public (verified or unverified) action is contract-aware", () => {
    expect(getAction("passenger.addFavorite")).toBeUndefined();
    expect(
      verifiedActionsForActor(ActorType.Passenger).map((a) => a.metadata.id),
    ).not.toContain("passenger.addFavorite");
  });

  it("drivers/buses only expose verified general discovery activity", () => {
    expect(
      verifiedActionsForActor(ActorType.Driver).every(
        (a) => a.metadata.verified,
      ),
    ).toBe(true);
    expect(
      verifiedActionsForActor(ActorType.Bus).every((a) => a.metadata.verified),
    ).toBe(true);
  });
});

describe("getAction", () => {
  it("finds an action by id", () => {
    expect(getAction("passenger.hail")?.metadata.id).toBe("passenger.hail");
  });

  it("returns undefined for unknown ids", () => {
    expect(getAction("nope")).toBeUndefined();
  });
});

describe("buildBody", () => {
  it("maps explicit body params (no selectors leaked into body)", () => {
    const body = buildBody(
      mustGet("passenger.reserve"),
      { busTripId: "10", boardingStopId: "20", alightingStopId: "30" },
      actor,
    );
    expect(body).toEqual({
      busTripId: "10",
      boardingStopId: "20",
      alightingStopId: "30",
    });
  });

  it("does not put a path selector in the body when the contract only wants it in path", () => {
    const body = buildBody(
      mustGet("passenger.cancelBooking"),
      { id: "99", reason: "changed plans" },
      actor,
    );
    expect(body).toEqual({ reason: "changed plans" });
    expect(body.id).toBeUndefined();
  });

  it("keeps only the command fields for rating (id stays in path)", () => {
    const body = buildBody(
      mustGet("passenger.rateTrip"),
      { id: "99", score: "5", comment: "" },
      actor,
    );
    expect(body).toEqual({ score: "5" });
  });

  it("skips empty optional fields", () => {
    const body = buildBody(
      mustGet("passenger.cancelBooking"),
      { id: "1", reason: "" },
      actor,
    );
    expect(body).toEqual({});
  });

  it("resolves internal.* dynamic mappings from actor.raw", () => {
    const body = buildBody(mustGet("driver.myBus"), {}, actor);
    expect(body.driverId).toBe(7);
  });

  it("does not expose an unverified passenger action (no /favorites contract)", () => {
    expect(getAction("passenger.addFavorite")).toBeUndefined();
  });
});

describe("buildPath", () => {
  it("substitutes {id} from args", () => {
    expect(buildPath(mustGet("driver.startTrip"), { id: "42" }, actor)).toBe(
      "/api/v1/bus-trips/42/start",
    );
  });

  it("substitutes {id} for cancel from args (body keeps only reason)", () => {
    expect(
      buildPath(mustGet("passenger.cancelBooking"), { id: "42" }, actor),
    ).toBe("/api/v1/user-trips/42/cancel");
  });

  it("substitutes driverId from actor.raw when not in args", () => {
    expect(buildPath(mustGet("driver.myBus"), {}, actor)).toBe(
      "/api/v1/buses/by-driver/7",
    );
  });
});

describe("buildQuery", () => {
  it("maps selectors to the documented query parameter names", () => {
    const q = buildQuery(mustGet("passenger.discoverTrips"), { routeId: "3" });
    expect(q).toEqual({ RouteId: "3" });
  });

  it("returns undefined when nothing is set", () => {
    expect(buildQuery(mustGet("passenger.discoverTrips"), {})).toBeUndefined();
  });
});

describe("validateActionArgs", () => {
  it("accepts complete required inputs and narrows them", () => {
    const result = validateActionArgs(mustGet("passenger.reserve"), {
      busTripId: "10",
      boardingStopId: "20",
      alightingStopId: "30",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects missing required inputs with field-level errors", () => {
    const result = validateActionArgs(mustGet("passenger.reserve"), {
      busTripId: "10",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.boardingStopId).toBe("fields.required");
      expect(result.errors.alightingStopId).toBe("fields.required");
      expect(result.errors.busTripId ?? undefined).toBeUndefined();
    }
  });

  it("derives a schema used by the BFF", () => {
    expect(
      actionSchema(mustGet("passenger.reserve")).safeParse({}).success,
    ).toBe(false);
  });
});

describe("summarizeAction", () => {
  it("returns a human-readable success summary with entity ids", () => {
    const summary = summarizeAction(mustGet("passenger.reserve"), {
      actorLabel: "Passenger 42",
      args: { busTripId: "184" },
      data: { id: 184 },
      ok: true,
      needsAuth: false,
    });
    expect(summary.key).toBe("result.passenger.reserved");
    expect(summary.params).toMatchObject({
      actor: "Passenger 42",
      trip: "184",
    });
  });

  it("marks failures distinctly and does not retry implications", () => {
    const summary = summarizeAction(mustGet("passenger.cancelBooking"), {
      actorLabel: "Passenger 42",
      args: { id: "9" },
      ok: false,
      needsAuth: false,
    });
    expect(summary.key).toBe("result.actionFailed");
    expect(summary.params?.actor).toBe("Passenger 42");
  });
});
