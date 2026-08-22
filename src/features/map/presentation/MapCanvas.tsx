"use client";

import type L from "leaflet";
import { Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import { ActorType } from "@/features/actors/domain/actor.types";
import type { MovementHandle } from "@/features/map/application/movement";
import {
  isMovable,
  startMoveActorAlongRoute,
} from "@/features/map/application/movement";
import { sendActorLocation } from "@/features/map/application/sendActorLocation";
import { getSignalRLocationAdapter } from "@/features/map/infrastructure/signalrLocationAdapter";
import { buildStaticPaths } from "@/features/sessions";
import { SessionSource } from "@/features/sessions/domain/session.types";
import { useSessionRecorder } from "@/shared/hooks/useSessionRecorder";
import { useI18n } from "@/shared/i18n";
import { tokens } from "@/shared/lib/tokens";
import { useActorStore } from "@/shared/store/actor.store";
import { useEnvironmentStore } from "@/shared/store/environment.store";
import { useMapStore } from "@/shared/store/map.store";
import { useSessionStore } from "@/shared/store/session.store";
import { LocationConfirmPopup } from "./LocationConfirmPopup";
import { MapDropZone } from "./MapDropZone";
import { MapMarkers } from "./MapMarkers";
import { MapRoute } from "./MapRoute";
import { MapToolbar } from "./MapToolbar";
import { MapViewportSync } from "./MapViewportSync";

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
  const sessionEvents = useSessionStore((s) => s.events);

  const route = useMapStore((s) => s.route);
  const drawing = useMapStore((s) => s.drawing);
  const following = useMapStore((s) => s.following);
  const followActorId = useMapStore((s) => s.followActorId);
  const speedKmh = useMapStore((s) => s.speedKmh);
  const showHistory = useMapStore((s) => s.showHistory);
  const startFollowing = useMapStore((s) => s.startFollowing);
  const stopFollowing = useMapStore((s) => s.stopFollowing);
  const resetForEnvironment = useMapStore((s) => s.resetForEnvironment);
  const locationStatus = useMapStore((s) => s.locationStatus);
  const setPendingLocation = useMapStore((s) => s.setPendingLocation);
  const confirmPendingLocation = useMapStore((s) => s.confirmPendingLocation);
  const cancelPendingLocation = useMapStore((s) => s.cancelPendingLocation);
  const setLocationStatus = useMapStore((s) => s.setLocationStatus);

  const mapRef = useRef<L.Map | null>(null);
  const movementRef = useRef<MovementHandle | null>(null);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const locationAdapterRef = useRef(getSignalRLocationAdapter());

  const staticPaths = useMemo(
    () => buildStaticPaths(sessionEvents),
    [sessionEvents],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset-on-env-change
  useEffect(() => {
    movementRef.current?.cancel();
    locationAdapterRef.current.disconnect().catch(() => {});
    resetForEnvironment();
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

  const handleMoveActor = useCallback(
    (actorId: string, lat: number, lng: number) => {
      const actor = workspace.find((a) => a.id === actorId);
      if (!actor) return;

      // Only drivers send location updates to the backend. Other actors are
      // placed visually on the map without any backend interaction.
      if (actor.type !== ActorType.Driver) {
        placeActor(actorId, lat, lng);
        recorder.record({
          source: SessionSource.System,
          actor: { id: actorId, label: actor.label },
          action: {
            id: "map.place",
            label: t("map.placeActor"),
            categoryId: "location",
          },
          summary: `${t("map.placementDone")}`,
          status: "info",
          position: { lat, lng },
        });
        return;
      }

      const originalLat = actor.lat ?? lat;
      const originalLng = actor.lng ?? lng;
      setPendingLocation(actorId, lat, lng, originalLat, originalLng);
    },
    [workspace, setPendingLocation, placeActor, recorder, t],
  );

  const handleConfirmLocation = useCallback(async () => {
    const pending = confirmPendingLocation();
    if (!pending) return;

    const actor = workspace.find((a) => a.id === pending.actorId);
    if (!actor) return;

    moveActor(pending.actorId, pending.lat, pending.lng);

    const env = useEnvironmentStore.getState().env;
    const result = await sendActorLocation(
      {
        actorId: pending.actorId,
        lat: pending.lat,
        lng: pending.lng,
        envRef: {
          envId: env.id,
          baseUrl: env.custom ? env.baseUrl : undefined,
        },
      },
      locationAdapterRef.current,
    );

    if (result.ok) {
      setLocationStatus(pending.actorId, "accepted");
    } else {
      setLocationStatus(pending.actorId, "rejected");
      moveActor(pending.actorId, pending.originalLat, pending.originalLng);
    }

    recorder.record({
      source: SessionSource.Manual,
      actor: { id: pending.actorId, label: actor.label, type: actor.type },
      action: {
        id: "driver.sendLocation",
        label: t("map.confirmLocation"),
        categoryId: "location",
      },
      summary: result.ok
        ? `${t("map.locationAccepted")}`
        : `${t("map.locationRejected")}: ${result.error}`,
      status: result.ok ? "success" : "failure",
      position: { lat: pending.lat, lng: pending.lng },
      ...(result.ok ? {} : { error: result.error }),
    });
  }, [
    confirmPendingLocation,
    workspace,
    moveActor,
    setLocationStatus,
    recorder,
    t,
  ]);

  const handleCancelLocation = useCallback(() => {
    cancelPendingLocation();
  }, [cancelPendingLocation]);

  const handleStartFollow = () => {
    if (selected) {
      startFollowing(selected.id);
    }
  };

  // Constant-speed automated movement along the drawn route, driven by the
  // application-level movement engine (injected scheduler, interpolated by
  // distance/time). The component only owns lifecycle wiring — no timer loops.
  useEffect(() => {
    if (!following || !followActorId || !isMovable(route)) return;

    const actor = workspaceRef.current.find((a) => a.id === followActorId);
    const actorRef = {
      id: followActorId,
      label: actor?.label || followActorId,
      ...(actor ? { type: actor.type } : {}),
    };
    const env = useEnvironmentStore.getState().env;
    const envRef = {
      envId: env.id,
      baseUrl: env.custom ? env.baseUrl : undefined,
    };
    const routePoints = route.map((p) => ({ lat: p.lat, lng: p.lng }));

    const handle = startMoveActorAlongRoute(
      { route: routePoints, speedKmh },
      {
        // The engine emits onStarted only once its first tick processes, so
        // an immediately-cancelled run (React StrictMode dev remount)
        // records nothing.
        onStarted: (pos) => {
          recorder.record({
            source: SessionSource.Workflow,
            actor: actorRef,
            action: {
              id: "map.movement",
              label: t("map.followRoute"),
              categoryId: "location",
            },
            summary: `${t("map.movementStarted")} (${routePoints.length} pts · ${speedKmh} km/h)`,
            status: "info",
            position: pos,
          });
        },
        onPosition: (pos) => {
          moveActor(followActorId, pos.lat, pos.lng);
        },
        onSendCompleted: (pos, result) => {
          recorder.record({
            source: SessionSource.Workflow,
            actor: actorRef,
            action: {
              id: "driver.sendLocation",
              label: t("map.locationUpdateSent"),
              categoryId: "location",
            },
            summary: result.ok
              ? t("map.locationUpdateSent")
              : `${t("map.locationRejected")}: ${result.error}`,
            status: result.ok ? "success" : "failure",
            position: pos,
            ...(result.ok ? {} : { error: result.error }),
          });
        },
        onEnded: (outcome) => {
          stopFollowing();
          if (movementRef.current === handle) movementRef.current = null;
          recorder.record({
            source: SessionSource.Workflow,
            actor: actorRef,
            action: {
              id: "map.movement",
              label: t("map.followRoute"),
              categoryId: "location",
            },
            summary:
              outcome.type === "completed"
                ? `${t("map.movementCompleted")} (${routePoints.length} pts)`
                : outcome.type === "cancelled"
                  ? t("map.movementCancelled")
                  : `${t("map.movementFailed")}: ${outcome.error}`,
            status:
              outcome.type === "completed"
                ? "success"
                : outcome.type === "cancelled"
                  ? "info"
                  : "failure",
            position: outcome.position,
            ...(outcome.type === "failed" ? { error: outcome.error } : {}),
          });
        },
      },
      {
        sendLocation: (pos) =>
          sendActorLocation(
            {
              actorId: followActorId,
              lat: pos.lat,
              lng: pos.lng,
              envRef,
            },
            locationAdapterRef.current,
          ),
      },
    );
    movementRef.current = handle;

    return () => {
      handle.cancel();
      if (movementRef.current === handle) movementRef.current = null;
    };
  }, [
    following,
    followActorId,
    route,
    speedKmh,
    recorder,
    moveActor,
    t,
    stopFollowing,
  ]);

  return (
    <MapDropZone mapRef={mapRef} onDrop={onDrop}>
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
        <MapViewportSync />
        <MapMarkers
          placed={placed}
          workspace={workspace}
          selectedActorId={selectedActorId}
          locationStatus={locationStatus}
          onMoveActor={handleMoveActor}
        />
        <MapRoute />
        {showHistory &&
          staticPaths.map((path) => (
            <Polyline
              key={path.actorId}
              positions={path.points.map(
                (p) => [p.lat, p.lng] as [number, number],
              )}
              pathOptions={{
                color: tokens.secondary,
                weight: 2,
                opacity: 0.7,
                dashArray: "6 6",
              }}
            />
          ))}
      </MapContainer>

      <MapToolbar
        hasRoute={route.length > 1}
        hasSelectedActor={!!selected}
        isFollowing={following}
        hasHistoryPaths={staticPaths.length > 0}
        onStartFollow={handleStartFollow}
        onStopFollow={stopFollowing}
      />

      <LocationConfirmPopup
        onConfirm={handleConfirmLocation}
        onCancel={handleCancelLocation}
      />

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

      {route.length > 1 && <SpeedControl />}

      {workspace.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[400] grid place-items-center">
          <div className="rounded-2xl border border-dashed border-border bg-surface/80 px-6 py-4 text-center text-sm text-ink-soft">
            {t("map.placeActor")}
          </div>
        </div>
      )}
    </MapDropZone>
  );
}

function SpeedControl() {
  const { t } = useI18n();
  const speedKmh = useMapStore((s) => s.speedKmh);
  const setSpeedKmh = useMapStore((s) => s.setSpeedKmh);

  return (
    <div
      className="absolute bottom-3 start-3 z-[500] flex items-center gap-2 rounded-xl border border-border bg-surface/95 px-3 py-2 text-xs text-ink-soft shadow-md"
      title={t("map.speedHint")}
    >
      <span>{t("map.autoMove")}</span>
      <input
        type="number"
        value={speedKmh}
        min={5}
        max={120}
        step={5}
        onChange={(e) => setSpeedKmh(Number(e.target.value) || 30)}
        className="h-8 w-20 rounded-md border border-border bg-surface-variant px-2 text-sm text-ink"
        dir="ltr"
      />
      <span>{t("map.speed")}</span>
    </div>
  );
}
