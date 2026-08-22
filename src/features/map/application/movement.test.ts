import { afterEach, describe, expect, it, vi } from "vitest";
import { haversineMeters } from "../domain/distance";
import type { LocationUpdateResult } from "../domain/locationPort";
import type { LatLng, MovementRoute } from "../domain/map.types";
import {
  createRealScheduler,
  DEFAULT_SEND_INTERVAL_MS,
  isMovable,
  startMoveActorAlongRoute,
  UI_UPDATE_INTERVAL_MS,
} from "./movement";

const START: LatLng = { lat: 0, lng: 0 };
const END: LatLng = { lat: 0.01, lng: 0 };
const ROUTE: MovementRoute = [START, END];
/** ~1111.95 m for the 0.01° northward segment. */
const ROUTE_METERS = haversineMeters(START, END);

afterEach(() => {
  vi.useRealTimers();
});

function useFakeClock(): void {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(0);
}

function okSend(): LocationUpdateResult {
  return { ok: true };
}

describe("isMovable", () => {
  it("requires at least two points", () => {
    expect(isMovable([])).toBe(false);
    expect(isMovable([START])).toBe(false);
    expect(isMovable(ROUTE)).toBe(true);
  });
});

describe("createRealScheduler", () => {
  it("delegates to global timers and clock", () => {
    const scheduler = createRealScheduler();
    expect(scheduler.now()).toBeTypeOf("number");
    expect(typeof scheduler.setTimeout).toBe("function");
    expect(typeof scheduler.clearTimeout).toBe("function");
  });
});

describe("startMoveActorAlongRoute validation", () => {
  it.each([
    ["single-point route", { route: [START], speedKmh: 36 }],
    ["empty route", { route: [], speedKmh: 36 }],
    ["zero speed", { route: ROUTE, speedKmh: 0 }],
    ["negative speed", { route: ROUTE, speedKmh: -10 }],
    ["non-finite speed", { route: ROUTE, speedKmh: Number.NaN }],
    [
      "non-positive send interval",
      { route: ROUTE, speedKmh: 36, sendIntervalMs: 0 },
    ],
  ])("rejects %s", (_name, input) => {
    expect(() =>
      startMoveActorAlongRoute(
        input,
        { onPosition: () => {}, onEnded: () => {} },
        { sendLocation: async () => okSend() },
      ),
    ).toThrow(RangeError);
  });
});

describe("startMoveActorAlongRoute lifecycle", () => {
  it("emits nothing when cancelled before the first tick (StrictMode remount)", async () => {
    useFakeClock();
    const onStarted = vi.fn();
    const onPosition = vi.fn();
    const onSendCompleted = vi.fn();
    const onEnded = vi.fn();
    const sendLocation = vi.fn(async (_pos: LatLng) => okSend());

    const handle = startMoveActorAlongRoute(
      { route: ROUTE, speedKmh: 36 },
      { onStarted, onPosition, onSendCompleted, onEnded },
      { sendLocation },
    );
    handle.cancel();

    await vi.advanceTimersByTimeAsync(2_000);

    expect(onStarted).not.toHaveBeenCalled();
    expect(onPosition).not.toHaveBeenCalled();
    expect(onSendCompleted).not.toHaveBeenCalled();
    expect(onEnded).not.toHaveBeenCalled();
    expect(sendLocation).not.toHaveBeenCalled();
  });

  it("emits started and the starting position on the first tick", async () => {
    useFakeClock();
    const onStarted = vi.fn();
    const onPosition = vi.fn();

    startMoveActorAlongRoute(
      { route: ROUTE, speedKmh: 36 },
      { onStarted, onPosition, onEnded: () => {} },
      { sendLocation: async () => okSend() },
    );

    await vi.advanceTimersByTimeAsync(UI_UPDATE_INTERVAL_MS);

    expect(onStarted).toHaveBeenCalledTimes(1);
    // First tick lands 100 ms in — within a few metres of the route start.
    expect(haversineMeters(START, onStarted.mock.calls[0][0])).toBeLessThan(5);
    expect(haversineMeters(START, onPosition.mock.calls[0][0])).toBeLessThan(5);
  });

  it("interpolates positions by distance over elapsed time", async () => {
    useFakeClock();
    const positions: LatLng[] = [];

    startMoveActorAlongRoute(
      { route: ROUTE, speedKmh: 36 },
      { onPosition: (pos) => positions.push(pos), onEnded: () => {} },
      { sendLocation: async () => okSend() },
    );

    // 5 s at 10 m/s → ~50 m travelled.
    await vi.advanceTimersByTimeAsync(5_000);

    const last = positions[positions.length - 1];
    expect(haversineMeters(START, last)).toBeCloseTo(50, 0);
  });

  it("sends the starting location immediately, then at the backend cadence", async () => {
    useFakeClock();
    const sendLocation = vi.fn(async (_pos: LatLng) => okSend());

    startMoveActorAlongRoute(
      { route: ROUTE, speedKmh: 36, sendIntervalMs: 1_000 },
      { onPosition: () => {}, onEnded: () => {} },
      { sendLocation },
    );

    await vi.advanceTimersByTimeAsync(UI_UPDATE_INTERVAL_MS);
    expect(sendLocation).toHaveBeenCalledTimes(1);
    expect(haversineMeters(START, sendLocation.mock.calls[0][0])).toBeLessThan(
      5,
    );

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sendLocation).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(3_000);
    // Sends at t≈1100, 2100, 3100, 4100 within this window.
    expect(sendLocation.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(sendLocation.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("keeps visual updates more frequent than backend sends", async () => {
    useFakeClock();
    let positions = 0;
    let sends = 0;

    startMoveActorAlongRoute(
      { route: ROUTE, speedKmh: 36, sendIntervalMs: 3_000 },
      {
        onPosition: () => {
          positions += 1;
        },
        onSendCompleted: () => {
          sends += 1;
        },
        onEnded: () => {},
      },
      { sendLocation: async () => okSend() },
    );

    await vi.advanceTimersByTimeAsync(10_000);

    expect(positions).toBeGreaterThanOrEqual(95);
    expect(sends).toBeLessThanOrEqual(5);
    expect(positions / Math.max(sends, 1)).toBeGreaterThan(15);
  });

  it("completes exactly once at the route end and sends the endpoint", async () => {
    useFakeClock();
    const onEnded = vi.fn();
    const onPosition = vi.fn();
    const sendLocation = vi.fn(async (_pos: LatLng) => okSend());
    const durationMs = (ROUTE_METERS / (36_000 / 3600)) * 1_000;

    const handle = startMoveActorAlongRoute(
      { route: ROUTE, speedKmh: 36 },
      { onPosition, onEnded },
      { sendLocation },
    );

    await vi.advanceTimersByTimeAsync(durationMs + 2 * UI_UPDATE_INTERVAL_MS);

    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onEnded).toHaveBeenCalledWith({
      type: "completed",
      position: END,
    });
    expect(handle.isActive()).toBe(false);
    expect(
      sendLocation.mock.calls.some(
        ([pos]) => pos.lat === END.lat && pos.lng === END.lng,
      ),
    ).toBe(true);

    const counts = {
      positions: onPosition.mock.calls.length,
      sends: sendLocation.mock.calls.length,
    };
    await vi.advanceTimersByTimeAsync(5_000);
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onPosition.mock.calls.length).toBe(counts.positions);
    expect(sendLocation.mock.calls.length).toBe(counts.sends);
  });

  it("completes a zero-length duplicate-point route with a single send", async () => {
    useFakeClock();
    const onEnded = vi.fn();
    const onPosition = vi.fn();
    const sendLocation = vi.fn(async (_pos: LatLng) => okSend());

    startMoveActorAlongRoute(
      { route: [START, { ...START }], speedKmh: 36 },
      { onPosition, onEnded },
      { sendLocation },
    );

    await vi.advanceTimersByTimeAsync(UI_UPDATE_INTERVAL_MS);

    expect(onEnded).toHaveBeenCalledWith({
      type: "completed",
      position: START,
    });
    expect(sendLocation).toHaveBeenCalledTimes(1);
    expect(onPosition).toHaveBeenCalledTimes(1);
  });

  it("cancels immediately and ignores further ticks", async () => {
    useFakeClock();
    const onEnded = vi.fn();
    const onPosition = vi.fn();
    const sendLocation = vi.fn(async (_pos: LatLng) => okSend());

    const handle = startMoveActorAlongRoute(
      { route: ROUTE, speedKmh: 36 },
      { onPosition, onEnded },
      { sendLocation },
    );

    await vi.advanceTimersByTimeAsync(1_500);
    expect(handle.isActive()).toBe(true);

    handle.cancel();
    expect(handle.isActive()).toBe(false);
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onEnded.mock.calls[0][0]).toMatchObject({ type: "cancelled" });

    const counts = {
      positions: onPosition.mock.calls.length,
      sends: sendLocation.mock.calls.length,
    };
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onPosition.mock.calls.length).toBe(counts.positions);
    expect(sendLocation.mock.calls.length).toBe(counts.sends);
  });

  it("drops an in-flight send result when cancelled mid-send", async () => {
    useFakeClock();
    let resolveSend!: (result: LocationUpdateResult) => void;
    const sendLocation = vi.fn(
      () =>
        new Promise<LocationUpdateResult>((resolve) => {
          resolveSend = resolve;
        }),
    );
    const onSendCompleted = vi.fn();
    const onEnded = vi.fn();

    const handle = startMoveActorAlongRoute(
      { route: ROUTE, speedKmh: 36 },
      { onPosition: () => {}, onSendCompleted, onEnded },
      { sendLocation },
    );

    await vi.advanceTimersByTimeAsync(UI_UPDATE_INTERVAL_MS);
    expect(sendLocation).toHaveBeenCalledTimes(1);

    handle.cancel();
    resolveSend(okSend());
    await vi.advanceTimersByTimeAsync(UI_UPDATE_INTERVAL_MS);

    expect(onSendCompleted).not.toHaveBeenCalled();
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onEnded.mock.calls[0][0]).toMatchObject({ type: "cancelled" });
  });
});

describe("startMoveActorAlongRoute failure behavior", () => {
  it("ends the run as failed on the first failed send under the stop policy", async () => {
    useFakeClock();
    const onEnded = vi.fn();
    const onSendCompleted = vi.fn();
    const sendLocation = vi.fn(
      async (): Promise<LocationUpdateResult> => ({
        ok: false,
        error: "boom",
        classification: { kind: "business" },
      }),
    );

    startMoveActorAlongRoute(
      { route: ROUTE, speedKmh: 36 },
      { onPosition: () => {}, onSendCompleted, onEnded },
      { sendLocation },
    );

    await vi.advanceTimersByTimeAsync(UI_UPDATE_INTERVAL_MS);

    expect(sendLocation).toHaveBeenCalledTimes(1);
    expect(onSendCompleted).toHaveBeenCalledTimes(1);
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onEnded).toHaveBeenCalledWith({
      type: "failed",
      position: expect.anything(),
      error: "boom",
    });

    const sends = sendLocation.mock.calls.length;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(sendLocation.mock.calls.length).toBe(sends);
  });

  it("continues past failed sends and still completes under the continue policy", async () => {
    useFakeClock();
    const onEnded = vi.fn();
    const failures: LocationUpdateResult = {
      ok: false,
      error: "flaky",
      classification: { kind: "infrastructure", subtype: "network" },
    };
    let call = 0;
    const sendLocation = vi.fn(async (): Promise<LocationUpdateResult> => {
      call += 1;
      return call % 2 === 0 ? failures : { ok: true };
    });

    const durationMs = (ROUTE_METERS / (36_000 / 3600)) * 1_000;
    startMoveActorAlongRoute(
      { route: ROUTE, speedKmh: 36, failurePolicy: "continue" },
      { onPosition: () => {}, onEnded },
      { sendLocation },
    );

    await vi.advanceTimersByTimeAsync(durationMs + 2 * UI_UPDATE_INTERVAL_MS);

    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onEnded.mock.calls[0][0]).toMatchObject({ type: "completed" });
    expect(call).toBeGreaterThan(DEFAULT_SEND_INTERVAL_MS / 100);
  });
});
