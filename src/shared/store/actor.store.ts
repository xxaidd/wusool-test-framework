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

  addToWorkspace: (actor: ActorRef) => void;
  removeFromWorkspace: (id: string) => void;
  setDiscovered: (actors: ActorRef[]) => void;
  selectActor: (id: string | null) => void;
  setSearch: (q: string) => void;
  setTypeFilter: (t: ActorType | "all") => void;
  placeActor: (actorId: string, lat: number, lng: number) => void;
  moveActor: (actorId: string, lat: number, lng: number) => void;
  updateActor: (actorId: string, patch: Partial<ActorRef>) => void;
  clearWorkspace: () => void;
  actorById: (id: string) => ActorRef | undefined;
}

export type { ActorState };

export const useActorStore = create<ActorState>()(
  persist(
    (set, get) => ({
      workspace: [],
      discovered: [],
      selectedActorId: null,
      search: "",
      typeFilter: "all",
      placed: [],

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

      clearWorkspace: () =>
        set({
          workspace: [],
          placed: [],
          selectedActorId: null,
          discovered: [],
          search: "",
          typeFilter: "all",
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
      // The server-side vault is in-memory and empty after a reload, so
      // persisted workspace actors must never be restored as "authenticated"
      // (mirrors environment.store resetting `adminConfigured:false`).
      merge: mergeActorState,
    },
  ),
);

export function actorTypeLabel(t: ActorType): string {
  return t === AT.Passenger ? "passenger" : t === AT.Driver ? "driver" : "bus";
}

/**
 * Persist-rehydration merge for the actor store. The server-side vault is
 * in-memory and empty after a reload, so persisted workspace actors must never
 * be restored as "authenticated" (mirrors environment.store resetting
 * `adminConfigured:false`). Exported for deterministic unit testing.
 */
export function mergeActorState(
  persisted: unknown,
  current: ActorState,
): ActorState {
  const p = persisted as Partial<ActorState> | undefined;
  return {
    ...current,
    ...p,
    workspace: (p?.workspace ?? []).map((a) => ({
      ...a,
      authenticated: false,
    })),
  };
}
