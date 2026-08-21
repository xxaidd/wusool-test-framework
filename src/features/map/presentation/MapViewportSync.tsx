"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useMapStore } from "@/shared/store/map.store";

/**
 * Syncs the useMapStore viewport state with the Leaflet map instance.
 * On mount, flies to the stored viewport. When the store viewport changes
 * (e.g. from environment reset), updates the map accordingly.
 */
export function MapViewportSync() {
  const map = useMap();
  const viewport = useMapStore((s) => s.viewport);

  useEffect(() => {
    map.flyTo([viewport.center.lat, viewport.center.lng], viewport.zoom, {
      animate: false,
    });
  }, [map, viewport]);

  return null;
}
