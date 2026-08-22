"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LatLng } from "@/features/map/domain/map.types";

const DEFAULT_CENTER: LatLng = { lat: 32.027, lng: 44.3887 };
const DEFAULT_ZOOM = 12;

export type LocationStatus =
  | "visual"
  | "pending"
  | "sent"
  | "accepted"
  | "rejected";

export interface PendingLocation {
  actorId: string;
  lat: number;
  lng: number;
  originalLat: number;
  originalLng: number;
}

interface MapState {
  route: LatLng[];
  drawing: boolean;
  following: boolean;
  followActorId: string | null;
  speedKmh: number;
  showHistory: boolean;
  viewport: { center: LatLng; zoom: number };
  pendingLocation: PendingLocation | null;
  locationStatus: Record<string, LocationStatus>;

  addRoutePoint: (point: LatLng) => void;
  undoRoutePoint: () => void;
  clearRoute: () => void;
  startDrawing: () => void;
  finishDrawing: () => void;
  cancelDrawing: () => void;
  startFollowing: (actorId: string) => void;
  stopFollowing: () => void;
  setSpeedKmh: (kmh: number) => void;
  toggleHistory: () => void;
  setViewport: (center: LatLng, zoom: number) => void;
  setPendingLocation: (
    actorId: string,
    lat: number,
    lng: number,
    originalLat: number,
    originalLng: number,
  ) => void;
  confirmPendingLocation: () => PendingLocation | null;
  cancelPendingLocation: () => void;
  setLocationStatus: (actorId: string, status: LocationStatus) => void;
  resetForEnvironment: () => void;
}

const INITIAL_STATE = {
  route: [] as LatLng[],
  drawing: false,
  following: false,
  followActorId: null as string | null,
  speedKmh: 30,
  showHistory: false,
  viewport: { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM },
  pendingLocation: null as PendingLocation | null,
  locationStatus: {} as Record<string, LocationStatus>,
};

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      addRoutePoint: (point) =>
        set((s) => {
          const last = s.route[s.route.length - 1];
          if (last && last.lat === point.lat && last.lng === point.lng) {
            return s;
          }
          return { route: [...s.route, point] };
        }),

      undoRoutePoint: () =>
        set((s) => ({
          route: s.route.slice(0, -1),
        })),

      clearRoute: () => set({ route: [] }),

      startDrawing: () => set({ drawing: true, route: [], following: false }),

      finishDrawing: () => set({ drawing: false }),

      cancelDrawing: () => set({ drawing: false, route: [] }),

      startFollowing: (actorId) =>
        set({ following: true, followActorId: actorId }),

      stopFollowing: () => set({ following: false, followActorId: null }),

      setSpeedKmh: (speedKmh) => set({ speedKmh }),

      toggleHistory: () => set((s) => ({ showHistory: !s.showHistory })),

      setViewport: (center, zoom) => set({ viewport: { center, zoom } }),

      setPendingLocation: (actorId, lat, lng, originalLat, originalLng) =>
        set((s) => ({
          pendingLocation: { actorId, lat, lng, originalLat, originalLng },
          locationStatus: {
            ...s.locationStatus,
            [actorId]: "pending" as LocationStatus,
          },
        })),

      confirmPendingLocation: () => {
        const pending = get().pendingLocation;
        if (!pending) return null;
        set((s) => ({
          pendingLocation: null,
          locationStatus: {
            ...s.locationStatus,
            [pending.actorId]: "sent" as LocationStatus,
          },
        }));
        return pending;
      },

      cancelPendingLocation: () => {
        const pending = get().pendingLocation;
        if (!pending) return;
        set((s) => ({
          pendingLocation: null,
          locationStatus: {
            ...s.locationStatus,
            [pending.actorId]: "visual" as LocationStatus,
          },
        }));
      },

      setLocationStatus: (actorId: string, status: LocationStatus) =>
        set((s) => ({
          locationStatus: { ...s.locationStatus, [actorId]: status },
        })),

      resetForEnvironment: () =>
        set({
          route: [],
          drawing: false,
          following: false,
          followActorId: null,
          showHistory: false,
          viewport: { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM },
          pendingLocation: null,
          locationStatus: {},
        }),
    }),
    {
      name: "wusool-map",
      partialize: (s) => ({ viewport: s.viewport }),
    },
  ),
);
