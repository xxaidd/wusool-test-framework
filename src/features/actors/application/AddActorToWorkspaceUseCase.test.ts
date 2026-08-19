import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ActorRef,
  ActorSource,
  ActorType,
} from "@/features/actors/domain/actor.types";
import type { ActorWorkspaceGateway } from "./ActorWorkspaceGateway";
import { AddActorToWorkspaceUseCase } from "./AddActorToWorkspaceUseCase";

describe("AddActorToWorkspaceUseCase", () => {
  let sampleActor: ActorRef;
  let addToWorkspace: ReturnType<typeof vi.fn<(actor: ActorRef) => void>>;
  let gateway: ActorWorkspaceGateway;

  beforeEach(() => {
    sampleActor = {
      id: "actor-1",
      type: ActorType.Passenger,
      label: "Test Actor",
      authenticated: false,
      source: ActorSource.Existing,
    };

    addToWorkspace = vi.fn<(actor: ActorRef) => void>();
    gateway = {
      isInWorkspace: vi.fn(() => false),
      addToWorkspace,
      selectActor: vi.fn(),
    };
  });

  it("adds actor to workspace when not already present", () => {
    const useCase = new AddActorToWorkspaceUseCase(gateway);
    useCase.execute(sampleActor);

    expect(addToWorkspace).toHaveBeenCalledWith(sampleActor);
  });

  it("does not add actor when already in workspace", () => {
    gateway.isInWorkspace = vi.fn(() => true);

    const useCase = new AddActorToWorkspaceUseCase(gateway);
    useCase.execute(sampleActor);

    expect(addToWorkspace).not.toHaveBeenCalled();
  });
});
