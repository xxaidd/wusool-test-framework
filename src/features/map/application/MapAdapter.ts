import type { ActorType } from "@/features/actors/domain/actor.types";
import type { LatLng, MovementRoute } from "../domain/map.types";

export interface MapMarker {
  id: string;
  position: LatLng;
  label: string;
  selected: boolean;
  kind: ActorType | "trip" | "stop";
}

export interface MapViewport {
  center: LatLng;
  zoom: number;
}

export type MapInteraction =
  | { type: "marker-click"; actorId: string }
  | { type: "map-click"; position: LatLng }
  | { type: "marker-drag-end"; actorId: string; position: LatLng };

export type MapUnsubscribe = () => void;

/**
 * Map abstraction keeping Leaflet/react-leaflet out of domain/application
 * code. Application emits/consumes plain data; Leaflet implements this in
 * Phase 4.
 */
export interface MapAdapter {
  renderMarkers(markers: MapMarker[]): void;
  drawRoute(route: MovementRoute): void;
  setViewport(viewport: MapViewport): void;
  subscribe(handler: (interaction: MapInteraction) => void): MapUnsubscribe;
}
