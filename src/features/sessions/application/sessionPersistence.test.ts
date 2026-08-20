import { describe, expect, it } from "vitest";
import { SessionStorageError } from "@/shared/errors";
import { SessionSource } from "../domain/session.types";
import { loadSession, toStoredSession } from "./sessionPersistence";
import { SESSION_FORMAT_VERSION } from "./sessionSerializer";

const event = {
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
} as const;

describe("toStoredSession", () => {
  it("builds a versioned stored session from a snapshot", () => {
    const stored = toStoredSession({
      sessionId: "ses_1",
      environmentId: "local",
      startedAt: "2024-01-01T00:00:00.000Z",
      name: "Smoke test",
      events: [event],
    });

    expect(stored).toEqual({
      sessionId: "ses_1",
      environmentId: "local",
      formatVersion: SESSION_FORMAT_VERSION,
      startedAt: "2024-01-01T00:00:00.000Z",
      name: "Smoke test",
      events: [event],
    });
  });

  it("omits optional metadata when absent", () => {
    const stored = toStoredSession({ events: [] });
    expect(stored.sessionId).toBe("");
    expect(stored.startedAt).toBeUndefined();
    expect(stored.name).toBeUndefined();
    expect(stored.updatedAt).toBeUndefined();
  });
});

describe("loadSession", () => {
  it("returns a typed stored session for a valid payload", () => {
    const stored = loadSession({
      sessionId: "ses_1",
      environmentId: "local",
      formatVersion: SESSION_FORMAT_VERSION,
      events: [event],
    });
    expect(stored.sessionId).toBe("ses_1");
    expect(stored.environmentId).toBe("local");
    expect(stored.events).toHaveLength(1);
  });

  it("throws SessionStorageError for a malformed payload", () => {
    expect(() => loadSession({ sessionId: "" })).toThrow(SessionStorageError);
  });

  it("throws SessionStorageError for an unsupported future format version", () => {
    expect(() =>
      loadSession({
        sessionId: "ses_1",
        environmentId: "local",
        formatVersion: SESSION_FORMAT_VERSION + 1,
        events: [],
      }),
    ).toThrow(SessionStorageError);
  });
});
