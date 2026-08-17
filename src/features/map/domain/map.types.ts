/** A geographic coordinate. Kept as plain data so domain code stays framework-free. */
export interface LatLng {
  lat: number;
  lng: number;
}

/** A movement route made of ordered coordinates. */
export type MovementRoute = LatLng[];
