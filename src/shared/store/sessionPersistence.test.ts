import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActorType } from "@/features/actors/domain/actor.types";
import { buildExecutionRecord } from "@/features/sessions/application/buildExecutionRecord";
import { loadSession } from "@/features/sessions/application/sessionPersistence";
import { SessionSource } from "@/features/sessions/domain/session.types";
import {
  getActiveSessionRef,
  indexedDbSessionStorage,
} from "@/features/sessions/infrastructure/indexedDbSessionStorage";
import { REDACTED } from "@/shared/redaction/redact";
import { useSessionStore } from "@/shared/store/session.store";
import {
  cancelPendingSave,
  flush,
  SAVE_DEBOUNCE_MS,
} from "./sessionPersistence";
import { sessionRecorder } from "./sessionRecorder";

const simpleEvent = {
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

const request = {
  method: "POST",
  path: "/api/v1/auth/login",
  headers: { Authorization: "Bearer secret-token" },
  body: JSON.stringify({ password: "hunter2", email: "a@b.c" }),
};

function resetStore() {
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
}

async function clearStored() {
  for (const summary of await indexedDbSessionStorage.list()) {
    await indexedDbSessionStorage.delete(summary.sessionId);
  }
  sessionStorage.clear();
}

describe("store-backed sessionPersistence", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    resetStore();
    await clearStored();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cancelPendingSave();
  });

  it("coalesces a burst of events into a single batched write", async () => {
    vi.useFakeTimers();
    const saveSpy = vi.spyOn(indexedDbSessionStorage, "save");

    useSessionStore.getState().start("Burst");
    useSessionStore.getState().appendEvent({ ...simpleEvent, id: "ev_a" });
    useSessionStore.getState().appendEvent({ ...simpleEvent, id: "ev_b" });
    useSessionStore.getState().appendEvent({ ...simpleEvent, id: "ev_c" });

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 50);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy.mock.calls[0][0].events).toHaveLength(3);
  });

  it("persists the active session and records the active pointer", async () => {
    useSessionStore.getState().start("Smoke test");
    useSessionStore.getState().setEnvId("local");
    useSessionStore.getState().appendEvent(simpleEvent);

    await flush();

    const ref = getActiveSessionRef();
    expect(ref).toMatchObject({ environmentId: "local", name: "Smoke test" });
    const stored = await indexedDbSessionStorage.load(ref?.sessionId ?? "");
    expect(stored?.events).toHaveLength(1);
    expect(useSessionStore.getState().storageError).toBeUndefined();
  });

  it("surfaces a storage failure once without dropping in-memory evidence", async () => {
    vi.spyOn(indexedDbSessionStorage, "save").mockRejectedValue(
      new Error("quota exceeded"),
    );

    useSessionStore.getState().start("Failure");
    useSessionStore.getState().appendEvent(simpleEvent);

    await flush();
    await flush();

    const state = useSessionStore.getState();
    expect(state.storageError).toBe("session.storageError");
    const storageFailures = state.events.filter(
      (e) =>
        e.classification?.kind === "infrastructure" &&
        e.classification.subtype === "storage",
    );
    expect(storageFailures).toHaveLength(1);
    expect(state.events.some((e) => e.id === simpleEvent.id)).toBe(true);
  });

  it("does not schedule further failing writes while a storage error is active", async () => {
    vi.useFakeTimers();
    vi.spyOn(indexedDbSessionStorage, "save").mockRejectedValue(
      new Error("quota exceeded"),
    );

    useSessionStore.getState().start("Failure");
    useSessionStore.getState().appendEvent(simpleEvent);

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 50);
    useSessionStore.getState().appendEvent({ ...simpleEvent, id: "ev_b" });
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 50);

    expect(
      useSessionStore
        .getState()
        .events.filter(
          (e) =>
            e.classification?.kind === "infrastructure" &&
            e.classification.subtype === "storage",
        ),
    ).toHaveLength(1);
  });

  it("restores an active session after a simulated reload", async () => {
    useSessionStore.getState().start("Smoke test");
    useSessionStore.getState().setEnvId("staging");
    useSessionStore.getState().appendEvent(simpleEvent);
    await flush();

    const ref = getActiveSessionRef();
    expect(ref).not.toBeNull();

    // Simulate reload: in-memory state is empty, pointer + IndexedDB remain.
    resetStore();

    const stored = await indexedDbSessionStorage.load(ref?.sessionId ?? "");
    expect(stored).not.toBeNull();
    const session = loadSession(stored);
    useSessionStore.getState().restore({
      sessionId: session.sessionId,
      envId: session.environmentId,
      startedAt: session.startedAt,
      name: session.name,
      events: session.events,
    });

    const state = useSessionStore.getState();
    expect(state.recording).toBe(true);
    expect(state.sessionId).toBe(session.sessionId);
    expect(state.envId).toBe("staging");
    expect(state.name).toBe("Smoke test");
    expect(state.events).toHaveLength(1);
  });

  it("never persists secrets in stored evidence", async () => {
    useSessionStore.getState().start("Redaction");
    useSessionStore.getState().setEnvId("local");
    sessionRecorder.record({
      source: SessionSource.Manual,
      actor: { id: "7", label: "Passenger 7", type: ActorType.Passenger },
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

    await flush();

    const ref = getActiveSessionRef();
    const stored = await indexedDbSessionStorage.load(ref?.sessionId ?? "");
    const json = JSON.stringify(stored);
    // Secret values never reach persisted evidence; only the redacted marker
    // and non-sensitive fields do.
    expect(json).not.toContain("hunter2");
    expect(json).not.toContain("secret-token");
    expect(json).not.toContain("session=abc");
    expect(json).toContain(REDACTED);
    const responseBody = JSON.parse(
      stored?.events[0].response?.body ?? "{}",
    ) as Record<string, string>;
    expect(responseBody.accessToken).toBe(REDACTED);
  });

  it("does not write when no active session exists", async () => {
    const saveSpy = vi.spyOn(indexedDbSessionStorage, "save");
    await flush();
    expect(saveSpy).not.toHaveBeenCalled();
    expect(getActiveSessionRef()).toBeNull();
  });

  it("scheduleSave is a no-op while a storage error is active", async () => {
    vi.useFakeTimers();
    const saveSpy = vi.spyOn(indexedDbSessionStorage, "save");
    useSessionStore.getState().start();
    useSessionStore.setState({ storageError: "session.storageError" });
    useSessionStore.getState().appendEvent(simpleEvent);
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 50);
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
