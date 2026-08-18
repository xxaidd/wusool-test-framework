"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ActorRef,
  ActorType,
  PlacedActor,
} from "@/features/actors/domain/actor.types";
import { ActorType as AT } from "@/features/actors/domain/actor.types";

interface ActorState {
  workspace: ActorRef[];
  discovered: ActorRef[];
  selectedActorId: string | null;
  search: string;
  typeFilter: ActorType | "all";
  placed: PlacedActor[];
  drawingRoute: boolean;

  addToWorkspace: (actor: ActorRef) => void;
  removeFromWorkspace: (id: string) => void;
  setDiscovered: (actors: ActorRef[]) => void;
  selectActor: (id: string | null) => void;
  setSearch: (q: string) => void;
  setTypeFilter: (t: ActorType | "all") => void;
  placeActor: (actorId: string, lat: number, lng: number) => void;
  moveActor: (actorId: string, lat: number, lng: number) => void;
  updateActor: (actorId: string, patch: Partial<ActorRef>) => void;
  setDrawingRoute: (v: boolean) => void;
  clearWorkspace: () => void;
  actorById: (id: string) => ActorRef | undefined;
}

export const useActorStore = create<ActorState>()(
  persist(
    (set, get) => ({
      workspace: [],
      discovered: [],
      selectedActorId: null,
      search: "",
      typeFilter: "all",
      placed: [],
      drawingRoute: false,

      addToWorkspace: (actor) => {
        if (get().workspace.some((a) => a.id === actor.id)) return;
        set((s) => ({ workspace: [...s.workspace, actor] }));
      },

      removeFromWorkspace: (id) =>
        set((s) => ({
          workspace: s.workspace.filter((a) => a.id !== id),
          selectedActorId: s.selectedActorId === id ? null : s.selectedActorId,
          placed: s.placed.filter((p) => p.actorId !== id),
        })),

      setDiscovered: (discovered) => set({ discovered }),

      selectActor: (selectedActorId) => set({ selectedActorId }),

      setSearch: (search) => set({ search }),
      setTypeFilter: (typeFilter) => set({ typeFilter }),

      placeActor: (actorId, lat, lng) =>
        set((s) => {
          const others = s.placed.filter((p) => p.actorId !== actorId);
          return {
            placed: [...others, { actorId, lat, lng }],
            workspace: s.workspace.map((a) =>
              a.id === actorId ? { ...a, lat, lng } : a,
            ),
          };
        }),

      moveActor: (actorId, lat, lng) =>
        set((s) => ({
          placed: s.placed.map((p) =>
            p.actorId === actorId ? { ...p, lat, lng } : p,
          ),
          workspace: s.workspace.map((a) =>
            a.id === actorId ? { ...a, lat, lng } : a,
          ),
        })),

      updateActor: (actorId, patch) =>
        set((s) => ({
          workspace: s.workspace.map((a) =>
            a.id === actorId ? { ...a, ...patch } : a,
          ),
        })),

      setDrawingRoute: (drawingRoute) => set({ drawingRoute }),

      clearWorkspace: () =>
        set({
          workspace: [],
          placed: [],
          selectedActorId: null,
          discovered: [],
          search: "",
          typeFilter: "all",
          drawingRoute: false,
        }),

      actorById: (id) => get().workspace.find((a) => a.id === id),
    }),
    {
      name: "wusool-actors",
      partialize: (s) => ({
        workspace: s.workspace,
        placed: s.placed,
        selectedActorId: s.selectedActorId,
      }),
    },
  ),
);

export function actorTypeLabel(t: ActorType): string {
  return t === AT.Passenger ? "passenger" : t === AT.Driver ? "driver" : "bus";
}
