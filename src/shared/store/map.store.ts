"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LatLng } from "@/features/map/domain/map.types";

const DEFAULT_CENTER: LatLng = { lat: 32.027, lng: 44.3887 };
const DEFAULT_ZOOM = 12;

interface MapState {
  route: LatLng[];
  drawing: boolean;
  following: boolean;
  followActorId: string | null;
  speed: number;
  showHistory: boolean;
  viewport: { center: LatLng; zoom: number };

  addRoutePoint: (point: LatLng) => void;
  undoRoutePoint: () => void;
  clearRoute: () => void;
  startDrawing: () => void;
  finishDrawing: () => void;
  cancelDrawing: () => void;
  startFollowing: (actorId: string) => void;
  stopFollowing: () => void;
  setSpeed: (ms: number) => void;
  toggleHistory: () => void;
  setViewport: (center: LatLng, zoom: number) => void;
  resetForEnvironment: () => void;
}

const INITIAL_STATE = {
  route: [] as LatLng[],
  drawing: false,
  following: false,
  followActorId: null as string | null,
  speed: 400,
  showHistory: false,
  viewport: { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM },
};

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
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

      setSpeed: (speed) => set({ speed }),

      toggleHistory: () => set((s) => ({ showHistory: !s.showHistory })),

      setViewport: (center, zoom) => set({ viewport: { center, zoom } }),

      resetForEnvironment: () =>
        set({
          route: [],
          drawing: false,
          following: false,
          followActorId: null,
          showHistory: false,
          viewport: { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM },
        }),
    }),
    {
      name: "wusool-map",
      partialize: (s) => ({ viewport: s.viewport }),
    },
  ),
);
