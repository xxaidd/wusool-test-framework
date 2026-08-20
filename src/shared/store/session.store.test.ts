import { beforeEach, describe, expect, it } from "vitest";
import { SessionSource } from "@/features/sessions/domain/session.types";
import {
  getActiveSessionRef,
  indexedDbSessionStorage,
} from "@/features/sessions/infrastructure/indexedDbSessionStorage";
import { useSessionStore } from "@/shared/store/session.store";

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

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function clearStored() {
  for (const summary of await indexedDbSessionStorage.list()) {
    await indexedDbSessionStorage.delete(summary.sessionId);
  }
  sessionStorage.clear();
}

describe("useSessionStore lifecycle", () => {
  beforeEach(async () => {
    useSessionStore.setState({
      recording: false,
      paused: false,
      startedAt: undefined,
      envId: undefined,
      events: [],
      sessionId: undefined,
      name: undefined,
      storageError: undefined,
    });
    await clearStored();
  });

  it("start() creates a stable session id and optional name", () => {
    useSessionStore.getState().start("Smoke test");
    const state = useSessionStore.getState();
    expect(state.recording).toBe(true);
    expect(state.sessionId).toMatch(/^ses_/);
    expect(state.name).toBe("Smoke test");
    expect(state.startedAt).toBeDefined();
  });

  it("start() without a name keeps name undefined", () => {
    useSessionStore.getState().start();
    expect(useSessionStore.getState().name).toBeUndefined();
  });

  it("each start() creates a distinct session id", () => {
    useSessionStore.getState().start("First");
    const first = useSessionStore.getState().sessionId;
    useSessionStore.getState().end();
    useSessionStore.getState().start("Second");
    expect(useSessionStore.getState().sessionId).not.toBe(first);
  });

  it("end() stops recording, keeps events in memory, and persists the record", async () => {
    useSessionStore.getState().start("Smoke test");
    useSessionStore.getState().setEnvId("local");
    useSessionStore.getState().appendEvent(event);

    useSessionStore.getState().end();
    await tick();

    const state = useSessionStore.getState();
    expect(state.recording).toBe(false);
    expect(state.events).toHaveLength(1);
    expect(state.sessionId).toBeDefined();
    // Ended sessions are retained as stored evidence but no longer auto-resume.
    expect(getActiveSessionRef()).toBeNull();
    const stored = await indexedDbSessionStorage.load(state.sessionId ?? "");
    expect(stored?.events).toHaveLength(1);
  });

  it("clear() deletes the persisted record, pointer, and in-memory state", async () => {
    useSessionStore.getState().start("Smoke test");
    useSessionStore.getState().setEnvId("local");
    useSessionStore.getState().appendEvent(event);
    await tick();

    const sessionId = useSessionStore.getState().sessionId ?? "";
    useSessionStore.getState().clear();
    await tick();

    const state = useSessionStore.getState();
    expect(state.events).toEqual([]);
    expect(state.sessionId).toBeUndefined();
    expect(state.recording).toBe(false);
    expect(getActiveSessionRef()).toBeNull();
    expect(await indexedDbSessionStorage.load(sessionId)).toBeNull();
  });

  it("appendEvent drops events while not recording or paused", () => {
    useSessionStore.getState().appendEvent(event);
    expect(useSessionStore.getState().events).toEqual([]);

    useSessionStore.getState().start();
    useSessionStore.getState().pause();
    useSessionStore.getState().appendEvent(event);
    expect(useSessionStore.getState().events).toEqual([]);
  });

  it("restore() resumes recording with the persisted session", () => {
    useSessionStore.getState().restore({
      sessionId: "ses_9",
      envId: "staging",
      startedAt: "2024-01-01T00:00:00.000Z",
      name: "Recovered",
      events: [event],
    });
    const state = useSessionStore.getState();
    expect(state.recording).toBe(true);
    expect(state.sessionId).toBe("ses_9");
    expect(state.envId).toBe("staging");
    expect(state.name).toBe("Recovered");
    expect(state.events).toEqual([event]);
  });

  it("finalizeForEnvironmentSwitch persists the prior session and starts a boundary event", async () => {
    useSessionStore.getState().start("Old env");
    useSessionStore.getState().setEnvId("local");
    useSessionStore.getState().appendEvent(event);
    await tick();

    const oldSessionId = useSessionStore.getState().sessionId ?? "";
    useSessionStore.getState().finalizeForEnvironmentSwitch({
      oldLabel: "Local",
      newLabel: "Staging",
      newEnvId: "staging",
      eventLabel: "Switch environment",
    });
    await tick();

    const state = useSessionStore.getState();
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({
      source: "system",
      actionId: "environment.switch",
    });
    expect(state.sessionId).toBeUndefined();
    expect(state.recording).toBe(false);
    expect(getActiveSessionRef()).toBeNull();
    // The old environment's session remains stored as evidence.
    const stored = await indexedDbSessionStorage.load(oldSessionId);
    expect(stored?.environmentId).toBe("local");
    expect(stored?.events).toHaveLength(1);
  });
});
