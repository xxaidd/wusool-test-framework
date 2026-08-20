import { describe, expect, it } from "vitest";
import {
  buildExecutionRecord,
  classifyExecutionOutcome,
} from "./buildExecutionRecord";

let idCounter = 0;
const createIdFn = (prefix: string) => `${prefix}_${++idCounter}`;

const base = {
  envId: "local",
  actorId: "7",
  actionId: "passenger.myBookings",
  startedAt: "2026-01-01T00:00:00.000Z",
  createIdFn,
};

const request = {
  method: "GET",
  path: "/api/v1/user-trips/me",
  headers: {},
};

describe("buildExecutionRecord", () => {
  it("generates unique execution and request ids", () => {
    const outcome = {
      ok: true,
      needsAuth: false,
      statusCode: 200,
      durationMs: 5,
      correlation: {},
      request,
    };

    const a = buildExecutionRecord({ ...base, outcome });
    const b = buildExecutionRecord({ ...base, outcome });

    expect(a.executionId).toMatch(/^exec_/);
    expect(b.executionId).toMatch(/^exec_/);
    expect(a.executionId).not.toBe(b.executionId);
    expect(a.requestId).toMatch(/^req_/);
    expect(b.requestId).toMatch(/^req_/);
    expect(a.requestId).not.toBe(b.requestId);
    expect(a.environmentId).toBe("local");
    expect(a.actorId).toBe("7");
    expect(a.actionId).toBe("passenger.myBookings");
    expect(a.startedAt).toBe(base.startedAt);
    expect(a.durationMs).toBe(5);
    expect(a.request).toEqual(request);
  });

  it("reuses the correlation id as the request id when present", () => {
    const record = buildExecutionRecord({
      ...base,
      outcome: {
        ok: true,
        needsAuth: false,
        statusCode: 200,
        durationMs: 5,
        correlation: { correlationId: "req_abc", traceId: "trace-1" },
        request,
        response: {
          statusCode: 200,
          headers: {},
          body: "{}",
        },
      },
    });

    expect(record.requestId).toBe("req_abc");
    expect(record.correlation).toEqual({
      correlationId: "req_abc",
      traceId: "trace-1",
    });
    expect(record.response?.statusCode).toBe(200);
  });

  it("classifies success outcomes", () => {
    expect(
      classifyExecutionOutcome({
        ok: true,
        needsAuth: false,
        statusCode: 200,
        durationMs: 1,
        request,
      }),
    ).toEqual({ kind: "success" });
  });

  it("classifies 4xx as business failures", () => {
    expect(
      classifyExecutionOutcome({
        ok: false,
        needsAuth: false,
        statusCode: 409,
        durationMs: 1,
        request,
      }),
    ).toEqual({ kind: "business" });
  });

  it("classifies 5xx as backend-unavailable infrastructure failures", () => {
    expect(
      classifyExecutionOutcome({
        ok: false,
        needsAuth: false,
        statusCode: 503,
        durationMs: 1,
        request,
      }),
    ).toEqual({ kind: "infrastructure", subtype: "backend-unavailable" });
  });

  it("classifies needs-auth as an authorization failure", () => {
    expect(
      classifyExecutionOutcome({
        ok: false,
        needsAuth: true,
        statusCode: 401,
        durationMs: 1,
        request,
      }),
    ).toEqual({ kind: "authorization", needsAuth: true });
  });

  it("prefers an explicit classification over the derived one", () => {
    const record = buildExecutionRecord({
      ...base,
      outcome: {
        ok: false,
        needsAuth: false,
        statusCode: undefined,
        durationMs: 1,
        correlation: {},
        request,
        classification: { kind: "infrastructure", subtype: "cancelled" },
      },
    });

    expect(record.classification).toEqual({
      kind: "infrastructure",
      subtype: "cancelled",
    });
  });
});
