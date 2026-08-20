import { describe, expect, it } from "vitest";
import type { SessionEvent } from "../domain/session.types";
import { SessionSource } from "../domain/session.types";
import { buildStaticPaths } from "./sessionPaths";

function event(partial: Partial<SessionEvent>): SessionEvent {
  return {
    id: partial.id ?? "ev_1",
    seq: partial.seq ?? 1,
    ts: partial.ts ?? "2026-08-19T12:00:00.000Z",
    source: partial.source ?? SessionSource.System,
    actorId: partial.actorId ?? "a1",
    actorLabel: partial.actorLabel ?? "Passenger #1",
    actionId: partial.actionId ?? "map.place",
    actionLabel: partial.actionLabel ?? "Place actor",
    categoryId: partial.categoryId ?? "location",
    summary: partial.summary ?? "Moved",
    status: partial.status ?? "info",
    position: partial.position,
    ...partial,
  };
}

describe("buildStaticPaths", () => {
  it("returns an empty list when no events carry a position", () => {
    const events = [event({ position: undefined })];
    expect(buildStaticPaths(events)).toEqual([]);
  });

  it("groups positioned events per actor in chronological order", () => {
    const events = [
      event({
        id: "ev_1",
        seq: 1,
        actorId: "a1",
        actorLabel: "Passenger #1",
        position: { lat: 32.01, lng: 44.1 },
      }),
      event({
        id: "ev_2",
        seq: 2,
        actorId: "a2",
        actorLabel: "Driver #7",
        position: { lat: 32.02, lng: 44.2 },
      }),
      event({
        id: "ev_3",
        seq: 3,
        actorId: "a1",
        position: { lat: 32.03, lng: 44.3 },
      }),
      event({
        id: "ev_4",
        seq: 4,
        actorId: "a2",
        position: { lat: 32.04, lng: 44.4 },
      }),
    ];
    const paths = buildStaticPaths(events);
    expect(paths).toHaveLength(2);
    const passenger = paths.find((p) => p.actorId === "a1");
    const driver = paths.find((p) => p.actorId === "a2");
    expect(passenger?.actorLabel).toBe("Passenger #1");
    expect(passenger?.points).toEqual([
      { lat: 32.01, lng: 44.1 },
      { lat: 32.03, lng: 44.3 },
    ]);
    expect(driver?.points).toEqual([
      { lat: 32.02, lng: 44.2 },
      { lat: 32.04, lng: 44.4 },
    ]);
  });

  it("orders points by seq even when input is unordered", () => {
    const events = [
      event({ id: "ev_3", seq: 3, position: { lat: 33, lng: 44 } }),
      event({ id: "ev_1", seq: 1, position: { lat: 31, lng: 44 } }),
      event({ id: "ev_2", seq: 2, position: { lat: 32, lng: 44 } }),
    ];
    const [path] = buildStaticPaths(events);
    expect(path.points.map((p) => p.lat)).toEqual([31, 32, 33]);
  });

  it("drops out-of-bounds points", () => {
    const events = [
      event({ seq: 1, position: { lat: 32, lng: 44 } }),
      event({ seq: 2, position: { lat: 91, lng: 44 } }),
      event({ seq: 3, position: { lat: 32.5, lng: 44.5 } }),
    ];
    const [path] = buildStaticPaths(events);
    expect(path.points).toEqual([
      { lat: 32, lng: 44 },
      { lat: 32.5, lng: 44.5 },
    ]);
  });

  it("drops non-finite coordinates", () => {
    const events = [
      event({ seq: 1, position: { lat: Number.NaN, lng: 44 } }),
      event({ seq: 2, position: { lat: 32, lng: Number.POSITIVE_INFINITY } }),
      event({ seq: 3, position: { lat: 32, lng: 44 } }),
      event({ seq: 4, position: { lat: 32.5, lng: 44.5 } }),
    ];
    const [path] = buildStaticPaths(events);
    expect(path.points).toEqual([
      { lat: 32, lng: 44 },
      { lat: 32.5, lng: 44.5 },
    ]);
  });

  it("dedupes consecutive identical points", () => {
    const events = [
      event({ seq: 1, position: { lat: 32, lng: 44 } }),
      event({ seq: 2, position: { lat: 32, lng: 44 } }),
      event({ seq: 3, position: { lat: 32, lng: 44 } }),
      event({ seq: 4, position: { lat: 32.5, lng: 44.5 } }),
    ];
    const [path] = buildStaticPaths(events);
    expect(path.points).toEqual([
      { lat: 32, lng: 44 },
      { lat: 32.5, lng: 44.5 },
    ]);
  });

  it("returns only paths with at least two distinct points", () => {
    const events = [
      event({ seq: 1, position: { lat: 32, lng: 44 } }),
      event({ seq: 2, actorId: "a2", position: { lat: 33, lng: 44 } }),
    ];
    const paths = buildStaticPaths(events);
    expect(paths).toHaveLength(0);
  });

  it("keeps one point per actor even when a later duplicate is skipped", () => {
    const events = [
      event({ seq: 1, position: { lat: 32, lng: 44 } }),
      event({ seq: 2, position: { lat: 32, lng: 44 } }),
      event({ seq: 3, position: { lat: 33, lng: 44 } }),
    ];
    const [path] = buildStaticPaths(events);
    expect(path.points).toEqual([
      { lat: 32, lng: 44 },
      { lat: 33, lng: 44 },
    ]);
  });
});
