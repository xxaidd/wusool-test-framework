import { afterEach, describe, expect, it, vi } from "vitest";
import type { LatLng, MovementRoute } from "../domain/map.types";
import {
  createRouteFollower,
  isMovable,
  routeEnd,
  stepAlongRoute,
} from "./movement";

const route: MovementRoute = [
  { lat: 1, lng: 1 },
  { lat: 2, lng: 2 },
  { lat: 3, lng: 3 },
];

describe("stepAlongRoute", () => {
  it("returns undefined for an empty route", () => {
    expect(stepAlongRoute([], 0)).toBeUndefined();
  });

  it("returns the coordinate at the given step", () => {
    expect(stepAlongRoute(route, 1)).toEqual({ lat: 2, lng: 2 });
  });

  it("clamps beyond the end of the route", () => {
    expect(stepAlongRoute(route, 99)).toEqual({ lat: 3, lng: 3 });
  });
});

describe("isMovable", () => {
  it("is false for fewer than two points", () => {
    expect(isMovable([])).toBe(false);
    expect(isMovable([route[0]])).toBe(false);
  });

  it("is true for two or more points", () => {
    expect(isMovable(route)).toBe(true);
  });
});

describe("routeEnd", () => {
  it("returns undefined for an empty route", () => {
    expect(routeEnd([])).toBeUndefined();
  });

  it("returns the last coordinate", () => {
    expect(routeEnd(route)).toEqual({ lat: 3, lng: 3 });
  });
});

describe("createRouteFollower", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits each step in order and completes at the end", () => {
    vi.useFakeTimers();
    const steps: LatLng[] = [];
    let complete: LatLng | undefined;
    const follower = createRouteFollower(route, 100, {
      onStep: (pos) => steps.push(pos),
      onComplete: (pos) => {
        complete = pos;
      },
    });
    follower.start();
    vi.advanceTimersByTime(300);
    expect(steps).toEqual([
      { lat: 2, lng: 2 },
      { lat: 3, lng: 3 },
    ]);
    expect(complete).toEqual({ lat: 3, lng: 3 });
  });

  it("stop() halts further steps", () => {
    vi.useFakeTimers();
    const steps: LatLng[] = [];
    const follower = createRouteFollower(route, 100, {
      onStep: (pos) => steps.push(pos),
      onComplete: () => {},
    });
    follower.start();
    vi.advanceTimersByTime(100);
    follower.stop();
    vi.advanceTimersByTime(1000);
    expect(steps).toEqual([{ lat: 2, lng: 2 }]);
  });

  it("never steps or completes an un-movable route", () => {
    vi.useFakeTimers();
    const onStep = vi.fn();
    const onComplete = vi.fn();
    const follower = createRouteFollower([route[0]], 100, {
      onStep,
      onComplete,
    });
    follower.start();
    vi.advanceTimersByTime(1000);
    expect(onStep).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
