import {
  cumulativeDistances,
  positionAtDistance,
  routeLengthMeters,
} from "../domain/distance";
import type { LocationUpdateResult } from "../domain/locationPort";
import type { LatLng, MovementRoute } from "../domain/map.types";

/**
 * Conservative default cadence for backend location updates, used until an
 * approved backend rate limit exists (roadmap open question #6).
 */
export const DEFAULT_SEND_INTERVAL_MS = 1_000;

/**
 * Cadence of visual marker updates. Deliberately decoupled from (and more
 * frequent than) backend sends so the map animates smoothly without loading
 * the backend.
 */
export const UI_UPDATE_INTERVAL_MS = 100;

export type MovementFailurePolicy = "stop" | "continue";

export type MovementEndOutcome =
  | { type: "completed"; position: LatLng }
  | { type: "cancelled"; position: LatLng }
  | { type: "failed"; position: LatLng; error: string };

/** Injected clock/timer port keeping the engine deterministic and testable. */
export interface MovementScheduler {
  now(): number;
  setTimeout(handler: () => void, timeoutMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export function createRealScheduler(): MovementScheduler {
  return {
    now: () => Date.now(),
    setTimeout: (handler, timeoutMs) =>
      globalThis.setTimeout(handler, timeoutMs),
    clearTimeout: (handle) => {
      globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
  };
}

export interface MoveAlongRouteInput {
  route: MovementRoute;
  /** Constant ground speed in kilometres per hour (> 0). */
  speedKmh: number;
  /** Backend update cadence in milliseconds (defaults to {@link DEFAULT_SEND_INTERVAL_MS}). */
  sendIntervalMs?: number;
  /**
   * What a failed backend update does to the run:
   * `"stop"` (default) ends the run as failed; `"continue"` reports the
   * failure per update and keeps moving.
   */
  failurePolicy?: MovementFailurePolicy;
}

/** Transport binding prepared by the caller (actor identity + environment). */
export type SendLocationFn = (pos: LatLng) => Promise<LocationUpdateResult>;

export interface MovementEvents {
  /** Emitted on the first processed tick (not on construction), so an
   * immediately-cancelled run leaves no trace. */
  onStarted?(position: LatLng): void;
  /** Throttled visual position updates (UI cadence). */
  onPosition(position: LatLng): void;
  /** Every backend send outcome, success or failure (backend cadence). */
  onSendCompleted?(position: LatLng, result: LocationUpdateResult): void;
  /** Terminal event, emitted exactly once. */
  onEnded(outcome: MovementEndOutcome): void;
}

export interface MovementHandle {
  /** Stops the run immediately, including any in-flight send. */
  cancel(): void;
  isActive(): boolean;
}

/** Whether a route can be followed at all. */
export function isMovable(route: MovementRoute): boolean {
  return route.length >= 2;
}

interface EngineState {
  readonly scheduler: MovementScheduler;
  readonly sendLocation: SendLocationFn;
  readonly events: MovementEvents;
  readonly route: MovementRoute;
  readonly cum: number[];
  readonly totalMeters: number;
  readonly speedMps: number;
  readonly sendIntervalMs: number;
  readonly failurePolicy: MovementFailurePolicy;
  readonly uiIntervalMs: number;
}

/**
 * Starts constant-speed automated movement of an actor along a drawn route.
 *
 * The actor travels the polyline by interpolated distance over time
 * (`distance = speed × elapsed`). Visual marker updates are emitted at the UI
 * cadence while verified location updates are sent through the caller-bound
 * transport at the backend cadence. The run is cancellable at any moment,
 * deterministic under an injected {@link MovementScheduler}, and terminates
 * with exactly one `onEnded` outcome (`completed`, `cancelled`, or `failed`).
 *
 * A run cancelled before its first tick processes (e.g. React StrictMode's
 * dev remount) emits no events at all.
 */
export function startMoveActorAlongRoute(
  input: MoveAlongRouteInput,
  events: MovementEvents,
  deps: { scheduler?: MovementScheduler; sendLocation: SendLocationFn },
): MovementHandle {
  if (!isMovable(input.route)) {
    throw new RangeError("Movement requires a route with at least two points");
  }
  if (!Number.isFinite(input.speedKmh) || input.speedKmh <= 0) {
    throw new RangeError("speedKmh must be a positive finite number");
  }
  const sendIntervalMs = input.sendIntervalMs ?? DEFAULT_SEND_INTERVAL_MS;
  if (!Number.isFinite(sendIntervalMs) || sendIntervalMs <= 0) {
    throw new RangeError("sendIntervalMs must be a positive finite number");
  }

  const state: EngineState = {
    scheduler: deps.scheduler ?? createRealScheduler(),
    sendLocation: deps.sendLocation,
    events,
    route: input.route,
    cum: cumulativeDistances(input.route),
    totalMeters: routeLengthMeters(input.route),
    speedMps: (input.speedKmh * 1000) / 3600,
    sendIntervalMs,
    failurePolicy: input.failurePolicy ?? "stop",
    uiIntervalMs: UI_UPDATE_INTERVAL_MS,
  };

  let active = true;
  let timerHandle: unknown = null;
  let ended = false;
  let startedEmitted = false;
  let progressed = false;
  const startAt = state.scheduler.now();
  let nextTickAt = startAt;
  let lastSendAt = Number.NEGATIVE_INFINITY;
  let lastSentPos: LatLng | null = null;
  let lastKnownPos: LatLng = state.route[0];

  const clearTimer = () => {
    if (timerHandle != null) {
      state.scheduler.clearTimeout(timerHandle);
      timerHandle = null;
    }
  };

  const end = (outcome: MovementEndOutcome) => {
    if (ended || !active) return;
    ended = true;
    active = false;
    clearTimer();
    events.onEnded(outcome);
  };

  /**
   * Sends `pos` when due (or when forced). Returns false only when the run
   * must not continue (stopped policy failure or cancellation mid-send).
   * Results that arrive after cancellation are dropped silently.
   */
  const sendIfDue = async (pos: LatLng, force = false): Promise<boolean> => {
    if (!active) return false;
    const now = state.scheduler.now();
    if (!force && now - lastSendAt < state.sendIntervalMs) return true;
    if (
      lastSentPos &&
      lastSentPos.lat === pos.lat &&
      lastSentPos.lng === pos.lng
    ) {
      return true;
    }
    lastSendAt = now;
    lastSentPos = pos;
    const wasActive = active;
    const result = await state.sendLocation(pos);
    if (!wasActive || !active) return false;
    events.onSendCompleted?.(pos, result);
    if (!result.ok && state.failurePolicy === "stop") {
      end({
        type: "failed",
        position: pos,
        error: result.error,
      });
      return false;
    }
    return true;
  };

  const scheduleNext = () => {
    if (!active || ended) return;
    nextTickAt += state.uiIntervalMs;
    const delay = Math.max(0, nextTickAt - state.scheduler.now());
    timerHandle = state.scheduler.setTimeout(tick, delay);
  };

  const tick = (): void => {
    if (!active) return;
    progressed = true;
    const elapsedMs = state.scheduler.now() - startAt;
    const targetMeters = (state.speedMps * elapsedMs) / 1000;

    let pos = positionAtDistance(state.route, state.cum, targetMeters);
    let finished = false;
    if (!pos || targetMeters >= state.totalMeters) {
      pos = state.route[state.route.length - 1];
      finished = true;
    }

    if (!startedEmitted) {
      startedEmitted = true;
      events.onStarted?.(pos);
    }
    lastKnownPos = pos;
    events.onPosition(pos);

    void (async () => {
      // The very first tick announces the starting position to the backend.
      const ok = await sendIfDue(pos, finished || lastSentPos === null);
      if (!ok) return;
      if (finished) {
        end({ type: "completed", position: pos });
        return;
      }
      scheduleNext();
    })();
  };

  timerHandle = state.scheduler.setTimeout(tick, state.uiIntervalMs);

  return {
    cancel: () => {
      if (!active) return;
      // A run cancelled before its first tick (e.g. React StrictMode's dev
      // remount) stops silently — it never became observable.
      if (!progressed) {
        active = false;
        ended = true;
        clearTimer();
        return;
      }
      const pos = lastKnownPos;
      end({ type: "cancelled", position: pos });
    },
    isActive: () => active && !ended,
  };
}
