import L from "leaflet";
import type {
  MapAdapter,
  MapInteraction,
  MapMarker,
  MapUnsubscribe,
  MapViewport,
} from "../application/MapAdapter";
import type { MovementRoute } from "../domain/map.types";

/**
 * Concrete Leaflet implementation of the MapAdapter port.
 *
 * Lives in infrastructure so leaflet imports stay out of domain/application.
 * Presentation code instantiates this and passes it where needed.
 */
export class LeafletMapAdapter implements MapAdapter {
  private map: L.Map | null = null;
  private markers = new Map<string, L.Marker>();
  private routeLine: L.Polyline | null = null;
  private listeners: Array<(i: MapInteraction) => void> = [];

  attach(map: L.Map) {
    this.map = map;
  }

  detach() {
    this.clearMarkers();
    this.routeLine?.remove();
    this.routeLine = null;
    this.map = null;
  }

  renderMarkers(markers: MapMarker[]) {
    if (!this.map) return;
    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.id);
      const existing = this.markers.get(m.id);
      if (existing) {
        existing.setLatLng([m.position.lat, m.position.lng]);
        existing.setZIndexOffset(m.selected ? 1000 : 0);
      } else {
        const marker = L.marker([m.position.lat, m.position.lng], {
          zIndexOffset: m.selected ? 1000 : 0,
        }).addTo(this.map);
        marker.on("click", () =>
          this.emit({ type: "marker-click", actorId: m.id }),
        );
        marker.on("dragend", () => {
          const ll = marker.getLatLng();
          this.emit({
            type: "marker-drag-end",
            actorId: m.id,
            position: { lat: ll.lat, lng: ll.lng },
          });
        });
        this.markers.set(m.id, marker);
      }
    }
    for (const [id, marker] of this.markers) {
      if (!seen.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    }
  }

  drawRoute(route: MovementRoute) {
    if (!this.map) return;
    this.routeLine?.remove();
    if (route.length < 2) {
      this.routeLine = null;
      return;
    }
    const latlngs = route.map((p) => [p.lat, p.lng] as [number, number]);
    this.routeLine = L.polyline(latlngs, {
      color: "#FF5722",
      weight: 3,
    }).addTo(this.map);
  }

  setViewport(viewport: MapViewport) {
    this.map?.flyTo([viewport.center.lat, viewport.center.lng], viewport.zoom);
  }

  subscribe(handler: (interaction: MapInteraction) => void): MapUnsubscribe {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== handler);
    };
  }

  private emit(interaction: MapInteraction) {
    for (const l of this.listeners) l(interaction);
  }

  private clearMarkers() {
    for (const marker of this.markers.values()) marker.remove();
    this.markers.clear();
  }
}
