import { describe, expect, it } from "vitest";
import { ActorType } from "@/features/actors/domain/actor.types";
import { SessionSource } from "../domain/session.types";
import { createSessionEvent } from "./sessionEventFactory";

let idCounter = 0;
const createIdFn = (prefix: string) => `${prefix}_${++idCounter}`;
const clock = () => 1_700_000_000_000;
const now = new Date(clock()).toISOString();

const baseInput = {
  source: SessionSource.Manual,
  actor: { id: "7", label: "Passenger 7", type: ActorType.Passenger },
  action: {
    id: "passenger.myBookings",
    label: "My bookings",
    categoryId: "booking",
  },
  summary: "Listed my bookings",
  status: "success" as const,
};

describe("createSessionEvent", () => {
  it("builds an immutable event with an id, timestamp, and monotonic seq", () => {
    const a = createSessionEvent({ ...baseInput, clock, createIdFn });
    const b = createSessionEvent({ ...baseInput, clock, createIdFn });

    expect(Object.isFrozen(a)).toBe(true);
    expect(a.id).toMatch(/^ev_/);
    expect(b.id).toMatch(/^ev_/);
    expect(a.id).not.toBe(b.id);
    expect(a.ts).toBe(now);
    expect(a.seq).toBeGreaterThan(0);
    expect(b.seq).toBeGreaterThan(a.seq ?? 0);
    expect(a.source).toBe(SessionSource.Manual);
    expect(a.actorId).toBe("7");
    expect(a.actorLabel).toBe("Passenger 7");
    expect(a.actorType).toBe("passenger");
    expect(a.actionId).toBe("passenger.myBookings");
    expect(a.categoryId).toBe("booking");
    expect(a.summary).toBe("Listed my bookings");
    expect(a.status).toBe("success");
  });

  it("keeps chronological ordering under interleaved concurrent records", () => {
    const manual = createSessionEvent({
      ...baseInput,
      source: SessionSource.Manual,
      clock,
      createIdFn,
    });
    const workflow = createSessionEvent({
      ...baseInput,
      source: SessionSource.Workflow,
      summary: "Automated step",
      clock,
      createIdFn,
    });
    const system = createSessionEvent({
      ...baseInput,
      source: SessionSource.System,
      summary: "Backend unavailable",
      status: "failed",
      clock,
      createIdFn,
    });

    expect(manual.seq).toBeLessThan(workflow.seq ?? 0);
    expect(workflow.seq).toBeLessThan(system.seq ?? 0);
  });

  it("flattens execution trace metadata into the event", () => {
    const execution = {
      requestId: "req_abc",
      executionId: "exec_abc",
      environmentId: "local",
      actorId: "7",
      actionId: "passenger.myBookings",
      startedAt: now,
      durationMs: 12,
      request: {
        method: "GET",
        path: "/api/v1/user-trips/me",
        headers: {},
      },
      correlation: { correlationId: "req_abc", traceId: "trace-1" },
      classification: { kind: "success" },
    } as const;

    const event = createSessionEvent({
      ...baseInput,
      execution,
      baseUrl: "http://localhost:5002",
      clock,
      createIdFn,
    });

    expect(event.requestId).toBe("req_abc");
    expect(event.executionId).toBe("exec_abc");
    expect(event.correlationId).toBe("req_abc");
    expect(event.traceId).toBe("trace-1");
    expect(event.classification).toEqual({ kind: "success" });
    expect(event.durationMs).toBe(12);
    expect(event.statusCode).toBeUndefined();
    expect(event.request).toEqual({
      method: "GET",
      url: "http://localhost:5002/api/v1/user-trips/me",
      headers: {},
    });
    expect(Object.isFrozen(event.request)).toBe(true);
  });

  it("renders request URLs with baseUrl, path, and query", () => {
    const event = createSessionEvent({
      ...baseInput,
      execution: {
        requestId: "req_1",
        executionId: "exec_1",
        environmentId: "local",
        actorId: "7",
        actionId: "passenger.myBookings",
        startedAt: now,
        durationMs: 1,
        request: {
          method: "GET",
          path: "/api/v1/trips",
          query: { from: "stop-1", page: "1" },
          headers: {},
        },
        correlation: {},
        classification: { kind: "success" },
      },
      baseUrl: "https://wusool.example",
      clock,
      createIdFn,
    });

    expect(event.request?.url).toBe(
      "https://wusool.example/api/v1/trips?from=stop-1&page=1",
    );
  });

  it("redacts sensitive keys before they can reach storage", () => {
    const event = createSessionEvent({
      ...baseInput,
      execution: {
        requestId: "req_1",
        executionId: "exec_1",
        environmentId: "local",
        actorId: "7",
        actionId: "driver.startTrip",
        startedAt: now,
        durationMs: 5,
        request: {
          method: "POST",
          path: "/api/v1/bus-trips/42/start",
          headers: {
            Authorization: "Bearer secret",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password: "hunter2", id: 42 }),
        },
        response: {
          statusCode: 201,
          headers: { "Set-Cookie": "session=abc" },
          body: JSON.stringify({ accessToken: "tok", id: 42 }),
        },
        correlation: {},
        classification: { kind: "success" },
      },
      baseUrl: "http://localhost:5002",
      clock,
      createIdFn,
    });

    expect(event.request?.headers.Authorization).toBe("••••••••");
    expect(JSON.parse(event.request?.body ?? "{}")).toEqual({
      password: "••••••••",
      id: 42,
    });
    expect(event.response?.headers["Set-Cookie"]).toBe("••••••••");
    expect(JSON.parse(event.response?.body ?? "{}")).toEqual({
      accessToken: "••••••••",
      id: 42,
    });
    expect(event.statusCode).toBe(201);
  });

  it("carries a discriminated classification for a failed action", () => {
    const failed = createSessionEvent({
      ...baseInput,
      status: "failed",
      error: "Booking rejected",
      classification: { kind: "business" },
      clock,
      createIdFn,
    });
    const infra = createSessionEvent({
      ...baseInput,
      status: "failed",
      error: "Backend down",
      classification: {
        kind: "infrastructure",
        subtype: "backend-unavailable",
      },
      clock,
      createIdFn,
    });

    expect(failed.classification).toEqual({ kind: "business" });
    expect(infra.classification).toEqual({
      kind: "infrastructure",
      subtype: "backend-unavailable",
    });
  });

  it("builds system events without execution metadata", () => {
    const event = createSessionEvent({
      source: SessionSource.System,
      actor: { id: "system", label: "System" },
      action: { id: "map.place", label: "Place actor", categoryId: "location" },
      summary: "Placed",
      status: "info",
      position: { lat: 24.7, lng: 46.6 },
      clock,
      createIdFn,
    });

    expect(event.source).toBe(SessionSource.System);
    expect(event.status).toBe("info");
    expect(event.position).toEqual({ lat: 24.7, lng: 46.6 });
    expect(event.durationMs).toBeUndefined();
    expect(event.request).toBeUndefined();
    expect(event.requestId).toBeUndefined();
  });
});
