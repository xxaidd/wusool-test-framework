"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type ActorRef,
  ActorType as AT,
  actorWorkspaceKeyOf,
  type PlacedActor,
} from "@/features/actors/domain/actor.types";

interface ActorState {
  workspace: ActorRef[];
  discovered: ActorRef[];
  selectedActorId: string | null;
  search: string;
  typeFilter: AT | "all";
  placed: PlacedActor[];
  drawingRoute: boolean;

  addToWorkspace: (actor: ActorRef) => void;
  removeFromWorkspace: (key: string) => void;
  setDiscovered: (actors: ActorRef[]) => void;
  selectActor: (key: string | null) => void;
  setSearch: (q: string) => void;
  setTypeFilter: (t: AT | "all") => void;
  placeActor: (actorKey: string, lat: number, lng: number) => void;
  moveActor: (actorKey: string, lat: number, lng: number) => void;
  updateActor: (actorKey: string, patch: Partial<ActorRef>) => void;
  setDrawingRoute: (v: boolean) => void;
  clearWorkspace: () => void;
  actorByKey: (key: string) => ActorRef | undefined;
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
        const key = actorWorkspaceKeyOf(actor);
        if (get().workspace.some((a) => actorWorkspaceKeyOf(a) === key)) return;
        set((s) => ({ workspace: [...s.workspace, actor] }));
      },

      removeFromWorkspace: (key) =>
        set((s) => ({
          workspace: s.workspace.filter((a) => actorWorkspaceKeyOf(a) !== key),
          selectedActorId: s.selectedActorId === key ? null : s.selectedActorId,
          placed: s.placed.filter((p) => p.actorKey !== key),
        })),

      setDiscovered: (discovered) => set({ discovered }),

      selectActor: (selectedActorId) => set({ selectedActorId }),

      setSearch: (search) => set({ search }),
      setTypeFilter: (typeFilter) => set({ typeFilter }),

      placeActor: (actorKey, lat, lng) =>
        set((s) => {
          const others = s.placed.filter((p) => p.actorKey !== actorKey);
          return {
            placed: [...others, { actorKey, lat, lng }],
            workspace: s.workspace.map((a) =>
              actorWorkspaceKeyOf(a) === actorKey ? { ...a, lat, lng } : a,
            ),
          };
        }),

      moveActor: (actorKey, lat, lng) =>
        set((s) => ({
          placed: s.placed.map((p) =>
            p.actorKey === actorKey ? { ...p, lat, lng } : p,
          ),
          workspace: s.workspace.map((a) =>
            actorWorkspaceKeyOf(a) === actorKey ? { ...a, lat, lng } : a,
          ),
        })),

      updateActor: (actorKey, patch) =>
        set((s) => ({
          workspace: s.workspace.map((a) =>
            actorWorkspaceKeyOf(a) === actorKey ? { ...a, ...patch } : a,
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

      actorByKey: (key) =>
        get().workspace.find((a) => actorWorkspaceKeyOf(a) === key),
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

export function actorTypeLabel(t: AT): string {
  return t === AT.Passenger ? "passenger" : t === AT.Driver ? "driver" : "bus";
}
