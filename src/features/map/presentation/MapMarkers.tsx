"use client";

import L from "leaflet";
import { Marker, Tooltip } from "react-leaflet";
import type {
  ActorRef,
  PlacedActor,
} from "@/features/actors/domain/actor.types";
import { useI18n } from "@/shared/i18n";
import { actorColors, tokens } from "@/shared/lib/tokens";
import type { LocationStatus } from "@/shared/store/map.store";

const ICONS: Record<string, string> = {
  passenger:
    '<circle cx="12" cy="8" r="5"></circle><path d="M20 21a8 8 0 0 0-16 0"></path>',
  driver:
    '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
  bus: '<path d="M8 6v6"></path><path d="M15 6v6"></path><path d="M2 12h19.6"></path><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"></path><circle cx="7" cy="18" r="2"></circle><circle cx="17" cy="18" r="2"></circle>',
};

const STATUS_OVERLAY: Record<LocationStatus, string | null> = {
  visual: null,
  pending:
    '<circle cx="15" cy="6" r="5" fill="#F59E0B" stroke="white" stroke-width="1.5"/><text x="15" y="9" text-anchor="middle" fill="white" font-size="8" font-weight="bold">?</text>',
  sent: '<circle cx="15" cy="6" r="5" fill="#0EA5E9" stroke="white" stroke-width="1.5"/><text x="15" y="9" text-anchor="middle" fill="white" font-size="8" font-weight="bold">...</text>',
  accepted:
    '<circle cx="15" cy="6" r="5" fill="#10B981" stroke="white" stroke-width="1.5"/><path d="M12 6l2 2 4-4" stroke="white" stroke-width="1.5" fill="none"/>',
  rejected:
    '<circle cx="15" cy="6" r="5" fill="#EF4444" stroke="white" stroke-width="1.5"/><path d="M12.5 3.5l5 5M17.5 3.5l-5 5" stroke="white" stroke-width="1.5" fill="none"/>',
};

const STATUS_LABEL_KEYS: Record<Exclude<LocationStatus, "visual">, string> = {
  pending: "map.locationPending",
  sent: "map.locationSent",
  accepted: "map.locationAccepted",
  rejected: "map.locationRejected",
};

function markerIcon(type: string, status: LocationStatus) {
  const overlay = STATUS_OVERLAY[status];
  return L.divIcon({
    className: "",
    html: `<div class="actor-marker ${status === "pending" ? "pulse" : ""}" style="width:30px;height:30px;background:${actorColors[type] || tokens.primary}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[type] || ICONS.passenger}</svg>${overlay ? `<svg width="20" height="20" viewBox="0 0 20 20" class="status-overlay" style="position:absolute;top:-5px;right:-5px">${overlay}</svg>` : ""}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

interface MapMarkersProps {
  placed: PlacedActor[];
  workspace: ActorRef[];
  selectedActorId: string | null;
  locationStatus: Record<string, LocationStatus>;
  onMoveActor: (actorId: string, lat: number, lng: number) => void;
}

export function MapMarkers({
  placed,
  workspace,
  selectedActorId,
  locationStatus,
  onMoveActor,
}: MapMarkersProps) {
  const { t } = useI18n();
  return (
    <>
      {placed
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .map((p) => {
          const actor = workspace.find((a) => a.id === p.actorId);
          const type = actor?.type || "passenger";
          const isSel = actor?.id === selectedActorId;
          const status = locationStatus[p.actorId] || "visual";
          const isPending = status === "pending";
          const statusLabel =
            status === "visual" ? null : t(STATUS_LABEL_KEYS[status]);
          return (
            <Marker
              key={p.actorId}
              position={[p.lat, p.lng]}
              icon={markerIcon(type, status)}
              draggable={!isPending}
              eventHandlers={{
                dragend: (e) => {
                  const ll = (e.target as L.Marker).getLatLng();
                  onMoveActor(p.actorId, ll.lat, ll.lng);
                },
              }}
              zIndexOffset={isSel ? 1000 : 0}
            >
              {statusLabel && (
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -18]}
                  className={`location-status-tooltip status-${status}`}
                >
                  {statusLabel}
                </Tooltip>
              )}
            </Marker>
          );
        })}
    </>
  );
}
