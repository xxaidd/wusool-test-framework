/** A geographic coordinate. Kept as plain data so domain code stays framework-free. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** A movement route made of ordered coordinates. */
export type MovementRoute = LatLng[];

/** Commands emitted by the application layer to drive map rendering imperatively. */
export type MapCommand =
  | { type: "set-viewport"; center: LatLng; zoom: number }
  | { type: "draw-route"; route: MovementRoute }
  | { type: "clear-route" }
  | { type: "highlight-marker"; id: string };
