"use client";

import { useCallback } from "react";

interface MapDropZoneProps {
  mapRef: React.RefObject<{
    mouseEventToLatLng: (e: MouseEvent) => { lat: number; lng: number };
  } | null>;
  onDrop: (actorId: string, lat: number, lng: number) => void;
  children: React.ReactNode;
}

/**
 * Handles HTML5 drag-and-drop from the ActorPanel onto the map.
 * Converts screen coordinates to lat/lng via the Leaflet map reference.
 */
export function MapDropZone({ mapRef, onDrop, children }: MapDropZoneProps) {
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/actor-id");
      if (id && mapRef.current) {
        const pt = mapRef.current.mouseEventToLatLng(
          e as unknown as MouseEvent,
        );
        onDrop(id, pt.lat, pt.lng);
      }
    },
    [mapRef, onDrop],
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop target for placing actors on the map
    <div
      className="relative isolate h-full w-full"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
}
