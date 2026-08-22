import type { LatLng, MovementRoute } from "./map.types";

/** Mean Earth radius in meters (IUGG). */
const EARTH_RADIUS_M = 6_371_008.8;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance between two coordinates in meters. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Prefix sums of segment lengths: `result[i]` is the distance from the start
 * of the route to `route[i]`. Always has the same length as the route.
 */
export function cumulativeDistances(route: MovementRoute): number[] {
  const cum: number[] = new Array(route.length);
  let total = 0;
  for (let i = 0; i < route.length; i++) {
    if (i > 0) total += haversineMeters(route[i - 1], route[i]);
    cum[i] = total;
  }
  return cum;
}

/** Total length of a route in meters. */
export function routeLengthMeters(route: MovementRoute): number {
  if (route.length < 2) return 0;
  return cumulativeDistances(route)[route.length - 1];
}

/**
 * Interpolated position at `meters` along the polyline. Clamps to the route
 * bounds; zero-length segments are skipped.
 */
export function positionAtDistance(
  route: MovementRoute,
  cum: number[],
  meters: number,
): LatLng | undefined {
  if (route.length === 0) return undefined;
  if (route.length === 1 || meters <= 0) return route[0];

  const total = cum[cum.length - 1];
  if (meters >= total) return route[route.length - 1];

  for (let i = 1; i < route.length; i++) {
    const segStart = cum[i - 1];
    const segEnd = cum[i];
    if (segEnd <= segStart) continue;
    if (meters <= segEnd) {
      const t = (meters - segStart) / (segEnd - segStart);
      const a = route[i - 1];
      const b = route[i];
      return {
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
      };
    }
  }
  return route[route.length - 1];
}
