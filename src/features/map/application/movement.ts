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
