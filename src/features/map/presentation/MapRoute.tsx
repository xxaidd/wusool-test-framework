"use client";

import { Polyline, useMapEvents } from "react-leaflet";
import { tokens } from "@/shared/lib/tokens";
import { useMapStore } from "@/shared/store/map.store";

/**
 * Renders the drawn route polyline and handles map clicks to add points
 * while in drawing mode. This fixes the broken route drawing feature that
 * previously had no click handler on the map.
 */
export function MapRoute() {
  const route = useMapStore((s) => s.route);
  const drawing = useMapStore((s) => s.drawing);
  const addRoutePoint = useMapStore((s) => s.addRoutePoint);

  useMapEvents({
    click: (e) => {
      if (!drawing) return;
      addRoutePoint({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  if (route.length < 2) return null;

  return (
    <Polyline
      positions={route.map((p) => [p.lat, p.lng] as [number, number])}
      pathOptions={{ color: tokens.tertiary, weight: 3 }}
    />
  );
}
