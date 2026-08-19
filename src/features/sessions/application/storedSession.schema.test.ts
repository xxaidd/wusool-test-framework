import { describe, expect, it } from "vitest";
import { SessionSource } from "../domain/session.types";
import { SESSION_FORMAT_VERSION } from "./sessionSerializer";
import { storedSessionSchema } from "./storedSession.schema";

const validEvent = {
  id: "ev_1",
  ts: "2024-01-01T00:00:00.000Z",
  source: SessionSource.Manual,
  actorId: "7",
  actorLabel: "Passenger 7",
  actionId: "passenger.reserve",
  actionLabel: "Reserve",
  categoryId: "booking",
  summary: "Reserved",
  status: "success",
};

const validSession = {
  sessionId: "ses_1",
  environmentId: "local",
  formatVersion: SESSION_FORMAT_VERSION,
  startedAt: "2024-01-01T00:00:00.000Z",
  name: "Smoke test",
  events: [validEvent],
};

describe("storedSessionSchema", () => {
  it("accepts a valid stored session with optional metadata", () => {
    const result = storedSessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sessionId).toBe("ses_1");
      expect(result.data.events).toHaveLength(1);
    }
  });

  it("accepts a session with trace metadata and classification", () => {
    const withTrace = {
      ...validSession,
      events: [
        {
          ...validEvent,
          seq: 1,
          requestId: "req_1",
          executionId: "exec_1",
          correlationId: "req_1",
          traceId: "trace-1",
          classification: { kind: "infrastructure", subtype: "cancelled" },
          request: {
            method: "POST",
            url: "http://localhost:5002/api/v1/bookings",
            headers: { Authorization: "••••••••" },
            body: '{"tripId":1}',
          },
          response: {
            status: 201,
            headers: { "Set-Cookie": "••••••••" },
            body: '{"ok":true}',
          },
        },
      ],
    };
    const result = storedSessionSchema.safeParse(withTrace);
    expect(result.success).toBe(true);
  });

  it("rejects a payload with a missing session id", () => {
    const { sessionId: _ignored, ...missing } = validSession;
    expect(storedSessionSchema.safeParse(missing).success).toBe(false);
  });

  it("rejects a payload with an invalid event shape", () => {
    const broken = {
      ...validSession,
      events: [{ id: "ev_1", status: "unknown" }],
    };
    expect(storedSessionSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects an unsupported future format version", () => {
    const future = {
      ...validSession,
      formatVersion: SESSION_FORMAT_VERSION + 1,
    };
    expect(storedSessionSchema.safeParse(future).success).toBe(false);
  });
});
