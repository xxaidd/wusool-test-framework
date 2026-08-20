import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import type { ActorWorkspaceGateway } from "./ActorWorkspaceGateway";
import { SelectActorUseCase } from "./SelectActorUseCase";

describe("SelectActorUseCase", () => {
  let sampleActorId: string;
  let selectActor: ReturnType<typeof vi.fn<(actorId: string | null) => void>>;
  let gateway: ActorWorkspaceGateway;

  beforeEach(() => {
    sampleActorId = "actor-1";
    selectActor = vi.fn<(actorId: string | null) => void>();
    gateway = {
      isInWorkspace: vi.fn(() => false),
      addToWorkspace: vi.fn<(actor: ActorRef) => void>(),
      selectActor,
    };
  });

  it("selects an actor by ID", () => {
    const useCase = new SelectActorUseCase(gateway);
    useCase.execute(sampleActorId);

    expect(selectActor).toHaveBeenCalledWith(sampleActorId);
  });

  it("clears selection when null is passed", () => {
    const useCase = new SelectActorUseCase(gateway);
    useCase.execute(null);

    expect(selectActor).toHaveBeenCalledWith(null);
  });
});
