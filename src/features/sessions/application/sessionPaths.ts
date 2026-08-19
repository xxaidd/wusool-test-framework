import type { SessionEvent } from "../domain/session.types";

export interface StaticPathPoint {
  lat: number;
  lng: number;
}

export interface StaticPath {
  actorId: string;
  actorLabel: string;
  points: StaticPathPoint[];
}

function inBounds(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Build static historical movement paths from recorded session events. Events
 * carrying a `position` are grouped per actor in chronological (`seq`) order,
 * out-of-bounds points are dropped, and consecutive identical points are
 * deduplicated. Only paths with at least two points are returned (a single
 * point cannot draw a movement path). Pure and framework-free; the map merely
 * visualizes the resulting plain coordinate data (FR-48).
 */
export function buildStaticPaths(
  events: readonly SessionEvent[],
): StaticPath[] {
  const ordered = [...events].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  const byActor = new Map<
    string,
    { label: string; points: StaticPathPoint[] }
  >();

  for (const ev of ordered) {
    if (ev.position == null) continue;
    const { lat, lng } = ev.position;
    if (!inBounds(lat, lng)) continue;

    const entry = byActor.get(ev.actorId);
    if (!entry) {
      byActor.set(ev.actorId, {
        label: ev.actorLabel,
        points: [{ lat, lng }],
      });
      continue;
    }
    const last = entry.points[entry.points.length - 1];
    if (last.lat === lat && last.lng === lng) continue;
    entry.points.push({ lat, lng });
  }

  const paths: StaticPath[] = [];
  for (const [actorId, entry] of byActor) {
    if (entry.points.length < 2) continue;
    paths.push({ actorId, actorLabel: entry.label, points: entry.points });
  }
  return paths;
}
