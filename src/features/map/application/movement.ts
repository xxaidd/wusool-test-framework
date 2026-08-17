import type { LatLng, MovementRoute } from "../domain/map.types";

/** Advance one step along a route. Returns the coordinate at `step` (clamped). */
export function stepAlongRoute(
  route: MovementRoute,
  step: number,
): LatLng | undefined {
  if (route.length === 0) return undefined;
  const idx = Math.min(step, route.length - 1);
  return route[idx];
}

/** Whether a route has at least two distinct points and can be followed. */
export function isMovable(route: MovementRoute): boolean {
  return route.length >= 2;
}

/** Final coordinate of a route, if any. */
export function routeEnd(route: MovementRoute): LatLng | undefined {
  return route.length > 0 ? route[route.length - 1] : undefined;
}

export interface RouteFollowerCallbacks {
  /** Called on every step after the start point, with the current coordinate and index. */
  onStep: (pos: LatLng, index: number) => void;
  /** Called once when the end of the route is reached. */
  onComplete: (pos: LatLng) => void;
}

export interface RouteFollower {
  start(): void;
  stop(): void;
}

/**
 * Drives constant-speed movement along a route at a fixed interval.
 * Framework-free and cancellable; the UI only feeds positions to the map.
 */
export function createRouteFollower(
  route: MovementRoute,
  intervalMs: number,
  cb: RouteFollowerCallbacks,
): RouteFollower {
  let timer: ReturnType<typeof setInterval> | null = null;
  let step = 0;

  const tick = () => {
    if (!isMovable(route)) {
      stop();
      return;
    }
    step += 1;
    const pos = stepAlongRoute(route, step);
    if (!pos) {
      stop();
      return;
    }
    if (step >= route.length - 1) {
      cb.onStep(pos, step);
      cb.onComplete(pos);
      stop();
      return;
    }
    cb.onStep(pos, step);
  };

  const start = () => {
    stop();
    step = 0;
    if (isMovable(route)) timer = setInterval(tick, intervalMs);
  };

  const stop = () => {
    if (timer != null) {
      clearInterval(timer);
      timer = null;
    }
  };

  return { start, stop };
}
