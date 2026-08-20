import { describe, expect, it } from "vitest";
import { ActorSource, ActorType } from "@/features/actors/domain/actor.types";
import type { ActorState } from "@/shared/store/actor.store";
import { mergeActorState } from "@/shared/store/actor.store";

function currentState(): ActorState {
  return {
    workspace: [],
    discovered: [],
    selectedActorId: null,
    search: "",
    typeFilter: "all",
    placed: [],
    drawingRoute: false,
    addToWorkspace: () => undefined,
    removeFromWorkspace: () => undefined,
    setDiscovered: () => undefined,
    selectActor: () => undefined,
    setSearch: () => undefined,
    setTypeFilter: () => undefined,
    placeActor: () => undefined,
    moveActor: () => undefined,
    updateActor: () => undefined,
    setDrawingRoute: () => undefined,
    clearWorkspace: () => undefined,
    actorById: () => undefined,
  };
}

describe("mergeActorState", () => {
  it("resets every restored workspace actor's authenticated flag to false", () => {
    const persisted = {
      workspace: [
        {
          id: "u1",
          type: ActorType.Passenger,
          label: "Passenger",
          sublabel: "u1@example.com",
          authenticated: true,
          source: ActorSource.Test,
        },
      ],
      placed: [{ id: "u1", latitude: 1, longitude: 2 }],
      selectedActorId: "u1",
    };

    const merged = mergeActorState(persisted, currentState());

    expect(merged.workspace).toHaveLength(1);
    expect(merged.workspace[0]).toMatchObject({
      id: "u1",
      label: "Passenger",
      authenticated: false,
    });
    expect(merged.placed).toEqual(persisted.placed);
    expect(merged.selectedActorId).toBe("u1");
  });

  it("keeps current state defaults when nothing is persisted", () => {
    const merged = mergeActorState(undefined, currentState());

    expect(merged.workspace).toEqual([]);
    expect(merged.search).toBe("");
  });
});
