import { describe, expect, it } from "vitest";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import { ActorSource, ActorType } from "@/features/actors/domain/actor.types";
import type { ActionDef } from "../domain/action.types";
import { ActionCategory } from "../domain/action.types";
import {
  actionsForActor,
  buildBody,
  buildPath,
  buildQuery,
  getAction,
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
      driverActions.every((a) => a.actorTypes.includes(ActorType.Driver)),
    ).toBe(true);
  });

  it("filters by category", () => {
    const trip = actionsForActor(ActorType.Passenger, ActionCategory.Trip);
    expect(trip.every((a) => a.category === ActionCategory.Trip)).toBe(true);
  });
});

describe("getAction", () => {
  it("finds an action by id", () => {
    expect(getAction("passenger.hail")?.id).toBe("passenger.hail");
  });

  it("returns undefined for unknown ids", () => {
    expect(getAction("nope")).toBeUndefined();
  });
});

describe("buildBody", () => {
  it("includes entity fields from args", () => {
    const body = buildBody(
      mustGet("passenger.hail"),
      { startStopId: "10", endStopId: "20" },
      actor,
    );
    expect(body).toEqual({ startStopId: "10", endStopId: "20" });
  });

  it("skips empty non-entity fields", () => {
    const body = buildBody(
      mustGet("passenger.rateTrip"),
      { id: "99", score: "5", comment: "" },
      actor,
    );
    expect(body).toEqual({ id: "99", score: "5" });
  });

  it("resolves internal.* dynamic mappings from actor.raw", () => {
    const body = buildBody(mustGet("driver.myBus"), {}, actor);
    expect(body.driverId).toBe(7);
  });

  it("keeps explicit args over arg-based dynamic mappings", () => {
    const body = buildBody(
      mustGet("passenger.addFavorite"),
      { type: "route", targetId: "55" },
      actor,
    );
    expect(body.targetId).toBe("55");
  });
});

describe("buildPath", () => {
  it("substitutes {id} from args", () => {
    expect(buildPath(mustGet("driver.startTrip"), { id: "42" }, actor)).toBe(
      "/api/v1/bus-trips/42/start",
    );
  });

  it("substitutes driverId from actor.raw when not in args", () => {
    expect(buildPath(mustGet("driver.myBus"), {}, actor)).toBe(
      "/api/v1/buses/by-driver/7",
    );
  });
});

describe("buildQuery", () => {
  it("builds a query from entity fields", () => {
    const q = buildQuery(mustGet("passenger.discoverTrips"), { routeId: "3" });
    expect(q).toEqual({ routeId: "3" });
  });

  it("returns undefined when nothing is set", () => {
    expect(buildQuery(mustGet("passenger.discoverTrips"), {})).toBeUndefined();
  });
});
