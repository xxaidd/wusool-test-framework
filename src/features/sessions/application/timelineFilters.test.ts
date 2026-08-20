import { describe, expect, it } from "vitest";
import type { SessionEvent } from "../domain/session.types";
import { SessionSource } from "../domain/session.types";
import { filterSessionEvents } from "./timelineFilters";

function event(partial: Partial<SessionEvent>): SessionEvent {
  return {
    id: partial.id ?? "ev_1",
    seq: partial.seq ?? 1,
    ts: partial.ts ?? "2026-08-19T12:00:00.000Z",
    source: partial.source ?? SessionSource.Manual,
    actorId: partial.actorId ?? "a1",
    actorLabel: partial.actorLabel ?? "Passenger #1",
    actionId: partial.actionId ?? "trip.reserve",
    actionLabel: partial.actionLabel ?? "Reserve trip",
    categoryId: partial.categoryId ?? "trip",
    summary: partial.summary ?? "Reserved trip #9",
    status: partial.status ?? "success",
    ...partial,
  };
}

const events = [
  event({
    id: "ev_1",
    seq: 1,
    source: SessionSource.Manual,
    actorLabel: "Passenger #1",
    summary: "Reserved trip #9",
    status: "success",
  }),
  event({
    id: "ev_2",
    seq: 2,
    source: SessionSource.Workflow,
    actorLabel: "Driver #7",
    actionLabel: "Send location",
    summary: "Sent location",
    status: "success",
  }),
  event({
    id: "ev_3",
    seq: 3,
    source: SessionSource.System,
    actorLabel: "System",
    actionId: "environment.switch",
    actionLabel: "Environment switched",
    summary: "local → staging",
    status: "info",
  }),
  event({
    id: "ev_4",
    seq: 4,
    source: SessionSource.Manual,
    actorLabel: "Passenger #1",
    actionId: "trip.cancel",
    actionLabel: "Cancel trip",
    summary: "Cancelled trip #9",
    status: "failed",
  }),
];

describe("filterSessionEvents", () => {
  it("returns every event in chronological order by default", () => {
    const result = filterSessionEvents(events);
    expect(result.map((e) => e.id)).toEqual(["ev_1", "ev_2", "ev_3", "ev_4"]);
  });

  it("sorts by seq even when the input is unordered", () => {
    const unordered = [events[3], events[1], events[0], events[2]];
    const result = filterSessionEvents(unordered);
    expect(result.map((e) => e.id)).toEqual(["ev_1", "ev_2", "ev_3", "ev_4"]);
  });

  it("filters by source", () => {
    const result = filterSessionEvents(events, {
      source: SessionSource.Manual,
    });
    expect(result.map((e) => e.id)).toEqual(["ev_1", "ev_4"]);
  });

  it("filters by status", () => {
    const result = filterSessionEvents(events, { status: "success" });
    expect(result.map((e) => e.id)).toEqual(["ev_1", "ev_2"]);
  });

  it("matches a case-insensitive text query across labels and summary", () => {
    expect(
      filterSessionEvents(events, { query: "trip #9" }).map((e) => e.id),
    ).toEqual(["ev_1", "ev_4"]);
    expect(
      filterSessionEvents(events, { query: "DRIVER" }).map((e) => e.id),
    ).toEqual(["ev_2"]);
    expect(
      filterSessionEvents(events, { query: "trip.cancel" }).map((e) => e.id),
    ).toEqual(["ev_4"]);
  });

  it("trims the query before matching", () => {
    const result = filterSessionEvents(events, { query: "  reserved  " });
    expect(result.map((e) => e.id)).toEqual(["ev_1"]);
  });

  it("combines query, source, and status filters", () => {
    const result = filterSessionEvents(events, {
      query: "passenger",
      source: SessionSource.Manual,
      status: "failed",
    });
    expect(result.map((e) => e.id)).toEqual(["ev_4"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterSessionEvents(events, { query: "nonexistent" })).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [...events];
    filterSessionEvents(input, { query: "driver" });
    expect(input).toHaveLength(events.length);
    expect(input.map((e) => e.id)).toEqual(events.map((e) => e.id));
  });
});
