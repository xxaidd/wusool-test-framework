import { beforeEach, describe, expect, it } from "vitest";
import {
  ActorSource,
  ActorType,
  actorWorkspaceKeyOf,
} from "@/features/actors/domain/actor.types";
import { useActorStore } from "@/shared/store/actor.store";

describe("useActorStore workspace keying", () => {
  beforeEach(() => {
    useActorStore.getState().clearWorkspace();
  });

  it("keeps actors with colliding raw ids across types distinct", () => {
    const passenger = {
      id: "7",
      type: ActorType.Passenger,
      label: "Passenger 7",
      authenticated: false,
      source: ActorSource.Existing,
    };
    const driver = {
      id: "7",
      type: ActorType.Driver,
      label: "Driver 7",
      authenticated: false,
      source: ActorSource.Existing,
    };

    useActorStore.getState().addToWorkspace(passenger);
    useActorStore.getState().addToWorkspace(driver);
    // Adding either again must not duplicate.
    useActorStore.getState().addToWorkspace(passenger);

    expect(useActorStore.getState().workspace).toHaveLength(2);
    expect(useActorStore.getState().workspace.map((a) => a.label)).toEqual([
      "Passenger 7",
      "Driver 7",
    ]);
  });

  it("selects, updates, moves, and removes by the typed workspace key", () => {
    const actor = {
      id: "7",
      type: ActorType.Passenger,
      label: "Passenger 7",
      authenticated: false,
      source: ActorSource.Existing,
    };
    const key = actorWorkspaceKeyOf(actor);
    useActorStore.getState().addToWorkspace(actor);

    useActorStore.getState().selectActor(key);
    expect(useActorStore.getState().selectedActorId).toBe("passenger:7");
    expect(useActorStore.getState().actorByKey(key)?.id).toBe("7");

    useActorStore
      .getState()
      .updateActor(key, { authenticated: true, lat: 32.1, lng: 44.2 });
    expect(useActorStore.getState().actorByKey(key)?.authenticated).toBe(true);

    useActorStore.getState().placeActor(key, 32.1, 44.2);
    expect(useActorStore.getState().placed).toEqual([
      { actorKey: key, lat: 32.1, lng: 44.2 },
    ]);

    useActorStore.getState().moveActor(key, 32.2, 44.3);
    expect(useActorStore.getState().placed[0].lat).toBe(32.2);
    expect(useActorStore.getState().actorByKey(key)?.lng).toBe(44.3);

    useActorStore.getState().removeFromWorkspace(key);
    expect(useActorStore.getState().workspace).toHaveLength(0);
    expect(useActorStore.getState().placed).toHaveLength(0);
    expect(useActorStore.getState().selectedActorId).toBeNull();
  });

  it("removing a typed key does not affect a colliding id of another type", () => {
    const passenger = {
      id: "7",
      type: ActorType.Passenger,
      label: "Passenger 7",
      authenticated: false,
      source: ActorSource.Existing,
    };
    const driver = {
      id: "7",
      type: ActorType.Driver,
      label: "Driver 7",
      authenticated: false,
      source: ActorSource.Existing,
    };
    useActorStore.getState().addToWorkspace(passenger);
    useActorStore.getState().addToWorkspace(driver);
    useActorStore.getState().selectActor(actorWorkspaceKeyOf(driver));

    useActorStore.getState().removeFromWorkspace("passenger:7");

    expect(useActorStore.getState().workspace).toEqual([driver]);
    expect(useActorStore.getState().selectedActorId).toBe("driver:7");
  });
});
