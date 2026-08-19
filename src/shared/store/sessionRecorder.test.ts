import { beforeEach, describe, expect, it } from "vitest";
import { ActorType } from "@/features/actors/domain/actor.types";
import { buildExecutionRecord } from "@/features/sessions/application/buildExecutionRecord";
import { SessionSource } from "@/features/sessions/domain/session.types";
import { REDACTED } from "@/shared/redaction/redact";
import { useSessionStore } from "@/shared/store/session.store";
import { sessionRecorder } from "./sessionRecorder";

const request = {
  method: "POST",
  path: "/api/v1/auth/login",
  headers: { Authorization: "Bearer secret-token" },
  body: JSON.stringify({ password: "hunter2", email: "a@b.c" }),
};

beforeEach(() => {
  useSessionStore.setState({
    recording: false,
    paused: false,
    startedAt: undefined,
    envId: undefined,
    events: [],
  });
});

function recordManual(summary = "Executed an action") {
  sessionRecorder.record({
    source: SessionSource.Manual,
    actor: { id: "7", label: "Passenger 7", type: ActorType.Passenger },
    action: {
      id: "passenger.myBookings",
      label: "My bookings",
      categoryId: "booking",
    },
    summary,
    status: "success",
  });
}

describe("sessionRecorder", () => {
  it("records events into the active session through the store", () => {
    sessionRecorder.start({ environmentId: "local" });
    recordManual();

    const session = useSessionStore.getState();
    expect(session.events).toHaveLength(1);
    expect(session.events[0]).toMatchObject({
      source: "manual",
      actorId: "7",
      actorLabel: "Passenger 7",
      actionId: "passenger.myBookings",
      summary: "Executed an action",
      status: "success",
    });
    expect(session.events[0].id).toMatch(/^ev_/);
    expect(typeof session.events[0].seq).toBe("number");
  });

  it("sets the environment id when the session starts through the recorder", () => {
    sessionRecorder.start({ environmentId: "staging" });
    expect(useSessionStore.getState().envId).toBe("staging");
    expect(useSessionStore.getState().recording).toBe(true);
  });

  it("drops events while the session is not recording", () => {
    recordManual();
    expect(useSessionStore.getState().events).toEqual([]);
  });

  it("drops events while the session is paused (unchanged behavior)", () => {
    sessionRecorder.start({ environmentId: "local" });
    useSessionStore.getState().pause();
    recordManual();
    expect(useSessionStore.getState().events).toEqual([]);
  });

  it("stop() ends recording", () => {
    sessionRecorder.start({ environmentId: "local" });
    sessionRecorder.stop();
    recordManual();
    expect(useSessionStore.getState().events).toEqual([]);
  });

  it("appends immutable events", () => {
    sessionRecorder.start({ environmentId: "local" });
    recordManual();
    const event = useSessionStore.getState().events[0];
    expect(Object.isFrozen(event)).toBe(true);
  });

  it("keeps manual and workflow events in chronological order", () => {
    sessionRecorder.start({ environmentId: "local" });
    recordManual("First");
    sessionRecorder.record({
      source: SessionSource.Workflow,
      actor: { id: "7", label: "Passenger 7" },
      action: { id: "wf.step", label: "Workflow step", categoryId: "booking" },
      summary: "Automated step",
      status: "success",
    });
    recordManual("Second");

    const events = useSessionStore.getState().events;
    expect(events.map((e) => e.source)).toEqual([
      "manual",
      "workflow",
      "manual",
    ]);
    expect(events[0].seq).toBeLessThan(events[1].seq ?? 0);
    expect(events[1].seq).toBeLessThan(events[2].seq ?? 0);
  });

  it("stores sanitized execution evidence with trace metadata", () => {
    sessionRecorder.start({ environmentId: "local" });
    sessionRecorder.record({
      source: SessionSource.Manual,
      actor: { id: "7", label: "Passenger 7" },
      action: {
        id: "passenger.reserve",
        label: "Reserve",
        categoryId: "booking",
      },
      summary: "Reserved a trip",
      status: "failure",
      error: "Booking rejected",
      baseUrl: "http://localhost:5002",
      execution: buildExecutionRecord({
        envId: "local",
        actorId: "7",
        actionId: "passenger.reserve",
        startedAt: "2026-01-01T00:00:00.000Z",
        outcome: {
          ok: false,
          needsAuth: false,
          statusCode: 409,
          durationMs: 8,
          correlation: { correlationId: "req_abc", traceId: "trace-1" },
          request,
          response: {
            statusCode: 409,
            headers: { "Set-Cookie": "session=abc" },
            body: JSON.stringify({ accessToken: "tok" }),
          },
        },
      }),
    });

    const event = useSessionStore.getState().events[0];
    expect(event.requestId).toBe("req_abc");
    expect(event.correlationId).toBe("req_abc");
    expect(event.traceId).toBe("trace-1");
    expect(event.executionId).toBeDefined();
    expect(event.classification).toEqual({ kind: "business" });
    expect(event.statusCode).toBe(409);
    expect(event.error).toBe("Booking rejected");
    expect(event.request?.url).toBe("http://localhost:5002/api/v1/auth/login");
    expect(event.request?.headers.Authorization).toBe(REDACTED);
    expect(JSON.parse(event.request?.body ?? "{}")).toEqual({
      password: REDACTED,
      email: "a@b.c",
    });
    expect(event.response?.headers["Set-Cookie"]).toBe(REDACTED);
    expect(JSON.parse(event.response?.body ?? "{}")).toEqual({
      accessToken: REDACTED,
    });
  });

  it("records a cancelled event with an infrastructure/cancelled classification", () => {
    sessionRecorder.start({ environmentId: "local" });
    sessionRecorder.record({
      source: SessionSource.Manual,
      actor: { id: "7", label: "Passenger 7" },
      action: {
        id: "passenger.myBookings",
        label: "My bookings",
        categoryId: "booking",
      },
      summary: "Listed my bookings",
      status: "info",
      error: "Cancel",
      classification: { kind: "infrastructure", subtype: "cancelled" },
    });

    const event = useSessionStore.getState().events[0];
    expect(event.status).toBe("info");
    expect(event.error).toBe("Cancel");
    expect(event.classification).toEqual({
      kind: "infrastructure",
      subtype: "cancelled",
    });
  });
});
