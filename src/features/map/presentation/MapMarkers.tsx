"use client";

import L from "leaflet";
import { Marker } from "react-leaflet";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import type { PlacedActor } from "@/features/actors/domain/actor.types";
import { actorColors, tokens } from "@/shared/lib/tokens";

const ICONS: Record<string, string> = {
  passenger:
    '<circle cx="12" cy="8" r="5"></circle><path d="M20 21a8 8 0 0 0-16 0"></path>',
  driver:
    '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
  bus: '<path d="M8 6v6"></path><path d="M15 6v6"></path><path d="M2 12h19.6"></path><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"></path><circle cx="7" cy="18" r="2"></circle><circle cx="17" cy="18" r="2"></circle>',
};

function markerIcon(type: string) {
  return L.divIcon({
    className: "",
    html: `<div class="actor-marker" style="width:30px;height:30px;background:${actorColors[type] || tokens.primary}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[type] || ICONS.passenger}</svg></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

interface MapMarkersProps {
  placed: PlacedActor[];
  workspace: ActorRef[];
  selectedActorId: string | null;
  onMoveActor: (actorId: string, lat: number, lng: number) => void;
}

export function MapMarkers({
  placed,
  workspace,
  selectedActorId,
  onMoveActor,
}: MapMarkersProps) {
  return (
    <>
      {placed
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .map((p) => {
          const actor = workspace.find((a) => a.id === p.actorId);
          const type = actor?.type || "passenger";
          const isSel = actor?.id === selectedActorId;
          return (
            <Marker
              key={p.actorId}
              position={[p.lat, p.lng]}
              icon={markerIcon(type)}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const ll = (e.target as L.Marker).getLatLng();
                  onMoveActor(p.actorId, ll.lat, ll.lng);
                },
              }}
              zIndexOffset={isSel ? 1000 : 0}
            />
          );
        })}
    </>
  );
}
