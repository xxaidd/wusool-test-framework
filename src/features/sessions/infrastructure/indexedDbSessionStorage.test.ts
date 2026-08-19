import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionStorageError } from "@/shared/errors";
import type { StoredSession } from "../application/SessionStorage";
import { SESSION_FORMAT_VERSION } from "../application/sessionSerializer";
import { SessionSource } from "../domain/session.types";
import {
  clearActiveSessionRef,
  getActiveSessionRef,
  indexedDbSessionStorage,
  setActiveSessionRef,
} from "./indexedDbSessionStorage";

const session: StoredSession = {
  sessionId: "ses_1",
  environmentId: "local",
  formatVersion: SESSION_FORMAT_VERSION,
  startedAt: "2024-01-01T00:00:00.000Z",
  name: "Smoke test",
  events: [
    {
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
    },
  ],
};

async function resetDb() {
  for (const summary of await indexedDbSessionStorage.list()) {
    await indexedDbSessionStorage.delete(summary.sessionId);
  }
  clearActiveSessionRef();
}

describe("indexedDbSessionStorage", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
  });

  it("saves and loads a session", async () => {
    await indexedDbSessionStorage.save(session);
    const loaded = await indexedDbSessionStorage.load("ses_1");
    expect(loaded).toEqual(session);
  });

  it("returns null when loading a missing session", async () => {
    expect(await indexedDbSessionStorage.load("missing")).toBeNull();
  });

  it("lists stored sessions with event counts", async () => {
    await indexedDbSessionStorage.save(session);
    const summaries = await indexedDbSessionStorage.list();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toEqual({
      sessionId: "ses_1",
      environmentId: "local",
      startedAt: "2024-01-01T00:00:00.000Z",
      eventCount: 1,
    });
  });

  it("overwrites an existing session on save (incremental persistence)", async () => {
    await indexedDbSessionStorage.save(session);
    const updated = {
      ...session,
      events: [...session.events, { ...session.events[0], id: "ev_2" }],
    };
    await indexedDbSessionStorage.save(updated);
    const loaded = await indexedDbSessionStorage.load("ses_1");
    expect(loaded?.events).toHaveLength(2);
  });

  it("handles a large session in one write", async () => {
    const large = {
      ...session,
      events: Array.from({ length: 5000 }, (_, i) => ({
        ...session.events[0],
        id: `ev_${i}`,
        seq: i,
      })),
    };
    await indexedDbSessionStorage.save(large);
    const loaded = await indexedDbSessionStorage.load("ses_1");
    expect(loaded?.events).toHaveLength(5000);
  });

  it("deletes a session", async () => {
    await indexedDbSessionStorage.save(session);
    await indexedDbSessionStorage.delete("ses_1");
    expect(await indexedDbSessionStorage.load("ses_1")).toBeNull();
  });

  it("throws SessionStorageError when IndexedDB is unavailable", async () => {
    const original = globalThis.indexedDB;
    Object.defineProperty(globalThis, "indexedDB", {
      value: undefined,
      configurable: true,
    });
    try {
      await expect(
        indexedDbSessionStorage.save(session),
      ).rejects.toBeInstanceOf(SessionStorageError);
      await expect(
        indexedDbSessionStorage.load("ses_1"),
      ).rejects.toBeInstanceOf(SessionStorageError);
    } finally {
      Object.defineProperty(globalThis, "indexedDB", {
        value: original,
        configurable: true,
      });
    }
  });

  it("normalizes a synchronous indexedDB.open throw into SessionStorageError", async () => {
    const factory = globalThis.indexedDB;
    const originalOpen = factory.open;
    Object.defineProperty(factory, "open", {
      value: () => {
        throw new Error("SecurityError");
      },
      configurable: true,
    });
    try {
      await expect(
        indexedDbSessionStorage.save(session),
      ).rejects.toBeInstanceOf(SessionStorageError);
    } finally {
      Object.defineProperty(factory, "open", {
        value: originalOpen,
        configurable: true,
      });
    }
  });

  it("repairs a pre-existing database that lacks the sessions store", async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("wusool-sessions", 1);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    await indexedDbSessionStorage.save(session);
    expect(await indexedDbSessionStorage.load("ses_1")).toEqual(session);
  });

  it("persists and clears the active-session pointer in sessionStorage", () => {
    expect(getActiveSessionRef()).toBeNull();
    setActiveSessionRef({
      sessionId: "ses_1",
      environmentId: "local",
      name: "Smoke test",
      startedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(getActiveSessionRef()).toEqual({
      sessionId: "ses_1",
      environmentId: "local",
      name: "Smoke test",
      startedAt: "2024-01-01T00:00:00.000Z",
    });
    clearActiveSessionRef();
    expect(getActiveSessionRef()).toBeNull();
  });
});
