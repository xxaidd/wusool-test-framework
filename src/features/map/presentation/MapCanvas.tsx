"use client";

import L from "leaflet";
import { Check, Pen, Play, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { RouteFollower } from "@/features/map/application/movement";
import { createRouteFollower } from "@/features/map/application/movement";
import type { LatLng } from "@/features/map/domain/map.types";
import { SessionSource } from "@/features/sessions/domain/session.types";
import { Button } from "@/shared/components/Button";
import { useSessionRecorder } from "@/shared/hooks/useSessionRecorder";
import { useI18n } from "@/shared/i18n";
import { actorColors, tokens } from "@/shared/lib/tokens";
import { useActorStore } from "@/shared/store/actor.store";
import { useEnvironmentStore } from "@/shared/store/environment.store";

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

function MapBridge({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, onReady]);
  return null;
}

const DEFAULT_CENTER: [number, number] = [32.027, 44.3887]; // University of Kufa

export function MapCanvas() {
  const { t } = useI18n();
  const workspace = useActorStore((s) => s.workspace);
  const placed = useActorStore((s) => s.placed);
  const placeActor = useActorStore((s) => s.placeActor);
  const moveActor = useActorStore((s) => s.moveActor);
  const selectedActorId = useActorStore((s) => s.selectedActorId);
  const recorder = useSessionRecorder();
  const envId = useEnvironmentStore((s) => s.env.id);

  const mapRef = useRef<L.Map | null>(null);
  const [route, setRoute] = useState<Array<[number, number]>>([]);
  const [drawing, setDrawing] = useState(false);
  const [following, setFollowing] = useState(false);
  const [speed, setSpeed] = useState(400);
  const [followActorId, setFollowActorId] = useState<string | null>(null);
  const followerRef = useRef<RouteFollower | null>(null);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  // Environment switches reset map-local work: routes, drawing, and automated
  // movement must never carry across environments (FR-36 / Task 1.3). Setting
  // `following` to false also stops the active RouteFollower via effect cleanup.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset-on-env-change
  useEffect(() => {
    setRoute([]);
    setDrawing(false);
    setFollowing(false);
    setFollowActorId(null);
  }, [envId]);

  const selected = workspace.find((a) => a.id === selectedActorId);

  const onDrop = (actorId: string, lat: number, lng: number) => {
    placeActor(actorId, lat, lng);
    recorder.record({
      source: SessionSource.System,
      actor: {
        id: actorId,
        label: workspace.find((a) => a.id === actorId)?.label || actorId,
      },
      action: {
        id: "map.place",
        label: t("map.placeActor"),
        categoryId: "location",
      },
      summary: `${t("map.placementDone")}`,
      status: "info",
      position: { lat, lng },
    });
  };

  const startDraw = () => {
    setRoute([]);
    setDrawing(true);
    setFollowing(false);
  };

  const finishDraw = () => {
    setDrawing(false);
    if (route.length > 1 && selected) {
      setFollowActorId(selected.id);
    }
  };

  // Constant-speed automated movement along the drawn route, driven by the
  // framework-free route follower so the engine stays out of the component.
  useEffect(() => {
    if (!following || !followActorId || route.length < 2) return;
    const latlngs: LatLng[] = route.map(([lat, lng]) => ({ lat, lng }));
    const follower = createRouteFollower(latlngs, speed, {
      onStep: (pos) => {
        moveActor(followActorId, pos.lat, pos.lng);
      },
      onComplete: (pos) => {
        setFollowing(false);
        recorder.record({
          source: SessionSource.Workflow,
          actor: {
            id: followActorId,
            label:
              workspaceRef.current.find((a) => a.id === followActorId)?.label ||
              followActorId,
          },
          action: {
            id: "map.follow",
            label: t("map.followRoute"),
            categoryId: "location",
          },
          summary: `${t("map.following")} (${route.length} pts)`,
          status: "success",
          position: { lat: pos.lat, lng: pos.lng },
        });
      },
    });
    followerRef.current = follower;
    follower.start();
    return () => {
      follower.stop();
      followerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [following, followActorId, route, speed, recorder, moveActor, t]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop target for placing actors on the map
    <div
      className="relative isolate h-full w-full"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/actor-id");
        if (id && mapRef.current) {
          const pt = mapRef.current.mouseEventToLatLng(
            e as unknown as MouseEvent,
          );
          onDrop(id, pt.lat, pt.lng);
        }
      }}
    >
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={12}
        className="h-full w-full"
        style={{ background: "var(--color-bg-base)" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBridge onReady={(m) => (mapRef.current = m)} />
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
                    moveActor(p.actorId, ll.lat, ll.lng);
                  },
                }}
                zIndexOffset={isSel ? 1000 : 0}
              />
            );
          })}
        {route.length > 1 && (
          <Polyline
            positions={route}
            pathOptions={{ color: tokens.tertiary, weight: 3 }}
          />
        )}
      </MapContainer>

      {/* Toolbar */}
      <div className="absolute start-3 top-3 z-[500] flex flex-col gap-1.5 rounded-xl border border-border bg-surface/95 p-1.5 shadow-md backdrop-blur">
        {!drawing ? (
          <Button variant="subtle" size="sm" onClick={startDraw}>
            <Pen size={15} />
            {t("map.startDrawing")}
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={finishDraw} disabled={route.length < 2}>
              <Check size={15} />
              {t("map.finishDrawing")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDrawing(false);
                setRoute([]);
              }}
            >
              <X size={15} />
              {t("map.cancelDrawing")}
            </Button>
          </>
        )}
        {route.length > 1 && !drawing && (
          <Button
            variant={following ? "danger" : "secondary"}
            size="sm"
            onClick={() => {
              if (following) {
                setFollowing(false);
              } else if (selected) {
                setFollowActorId(selected.id);
                setFollowing(true);
              }
            }}
            disabled={!selected}
          >
            {following ? (
              <>
                <Square size={15} />
                {t("map.stopFollowing")}
              </>
            ) : (
              <>
                <Play size={15} />
                {t("map.followRoute")}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Draw / follow hint */}
      {drawing && (
        <div className="absolute end-3 top-3 z-[500] rounded-lg border border-primary bg-primary-container px-3 py-1.5 text-xs font-medium text-on-primary-container shadow">
          {t("map.drawing")} · {route.length}
        </div>
      )}
      {following && followActorId && (
        <div className="absolute end-3 top-3 z-[500] flex items-center gap-1.5 rounded-lg border border-success bg-success-container px-3 py-1.5 text-xs font-medium text-success shadow">
          <Play size={13} />
          {t("map.following")}
        </div>
      )}

      {/* Speed control for automated movement */}
      {route.length > 1 && (
        <div className="absolute bottom-3 start-3 z-[500] flex items-center gap-2 rounded-xl border border-border bg-surface/95 px-3 py-2 text-xs text-ink-soft shadow-md">
          <span>{t("map.autoMove")}</span>
          <input
            type="number"
            value={speed}
            min={100}
            max={5000}
            step={100}
            onChange={(e) => setSpeed(Number(e.target.value) || 400)}
            className="h-8 w-20 rounded-md border border-border bg-surface-variant px-2 text-sm text-ink"
            dir="ltr"
          />
          <span>{t("map.speed")}</span>
        </div>
      )}

      {workspace.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[400] grid place-items-center">
          <div className="rounded-2xl border border-dashed border-border bg-surface/80 px-6 py-4 text-center text-sm text-ink-soft">
            {t("map.placeActor")}
          </div>
        </div>
      )}
    </div>
  );
}
