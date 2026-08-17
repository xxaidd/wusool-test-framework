import { describe, expect, it } from "vitest";
import type { SessionEvent } from "../domain/session.types";
import { SessionSource } from "../domain/session.types";
import { SESSION_FORMAT_VERSION, serializeSession } from "./sessionSerializer";

function event(): SessionEvent {
  return {
    id: "ev_1",
    ts: "2024-01-01T00:00:00.000Z",
    source: SessionSource.Manual,
    actorId: "7",
    actorLabel: "Driver 7",
    actionId: "driver.myBus",
    actionLabel: "My Bus",
    categoryId: "general",
    summary: "Loaded",
    status: "success",
  };
}

describe("serializeSession", () => {
  it("returns the versioned export format", () => {
    const startedAt = "2024-01-01T00:00:00.000Z";
    const payload = serializeSession({
      events: [event()],
      startedAt,
    });

    expect(payload.app).toBe("Wusool Testing Framework");
    expect(payload.formatVersion).toBe(SESSION_FORMAT_VERSION);
    expect(payload.startedAt).toBe(startedAt);
    expect(payload.eventCount).toBe(1);
    expect(payload.events).toEqual([event()]);
    expect(new Date(payload.exportedAt).getTime()).not.toBeNaN();
  });

  it("handles an empty session", () => {
    const payload = serializeSession({ events: [] });
    expect(payload.eventCount).toBe(0);
    expect(payload.events).toEqual([]);
    expect(payload.startedAt).toBeUndefined();
  });
});
