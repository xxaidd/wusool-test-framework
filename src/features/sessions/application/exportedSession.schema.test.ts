import { describe, expect, it } from "vitest";
import { exportedSessionSchema } from "./exportedSession.schema";
import { sessionLogSchema } from "./sessionLog.schema";

const event = {
  id: "ev_1",
  ts: "2024-01-01T00:00:00.000Z",
  source: "manual",
  actorId: "7",
  actorLabel: "Driver 7",
  actionId: "driver.myBus",
  actionLabel: "My Bus",
  categoryId: "general",
  summary: "Loaded",
  status: "success",
};

const base = {
  app: "Wusool Testing Framework",
  formatVersion: 1,
  exportedAt: "2024-01-01T00:00:00.000Z",
  eventCount: 1,
  events: [event],
};

describe("exportedSessionSchema", () => {
  it("accepts a valid version-1 export", () => {
    const parsed = exportedSessionSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.events).toHaveLength(1);
      expect(parsed.data.paths).toBeUndefined();
      expect(parsed.data.logs).toBeUndefined();
    }
  });

  it("accepts optional environment, paths, and logs", () => {
    const parsed = exportedSessionSchema.safeParse({
      ...base,
      sessionId: "ses_1",
      name: "Smoke test",
      startedAt: "2024-01-01T00:00:00.000Z",
      environment: { id: "local", label: "Local" },
      paths: [
        { actorId: "7", actorLabel: "Driver 7", points: [{ lat: 1, lng: 2 }] },
      ],
      logs: [
        {
          eventId: "ev_1",
          entries: [
            {
              ts: "2024-01-01T00:00:00.000Z",
              level: "info",
              message: "Request handled",
              metadata: { extra: "key" },
            },
          ],
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a mismatched eventCount", () => {
    const parsed = exportedSessionSchema.safeParse({
      ...base,
      eventCount: 2,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].path).toContain("eventCount");
    }
  });

  it("rejects missing required fields", () => {
    const { events: _events, ...missing } = base;
    expect(exportedSessionSchema.safeParse(missing).success).toBe(false);
    expect(exportedSessionSchema.safeParse({}).success).toBe(false);
  });

  it("tolerates unknown extra keys (forward compatibility)", () => {
    const parsed = exportedSessionSchema.safeParse({
      ...base,
      someFutureField: { nested: true },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unsupported future format versions", () => {
    const parsed = exportedSessionSchema.safeParse({
      ...base,
      formatVersion: 2,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("sessionLogSchema", () => {
  it("accepts a log entry and tolerates extra metadata keys", () => {
    const parsed = sessionLogSchema.safeParse({
      ts: "2024-01-01T00:00:00.000Z",
      level: "error",
      message: "boom",
      metadata: { route: { path: "/api/v1" } },
      extra: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an entry missing required fields", () => {
    expect(sessionLogSchema.safeParse({ level: "info" }).success).toBe(false);
  });
});