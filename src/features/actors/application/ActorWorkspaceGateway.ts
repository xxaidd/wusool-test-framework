import type { ActorRef } from "@/features/actors/domain/actor.types";

/**
 * Application-facing port over the test actors workspace.
 *
 * Keeps the Application layer decoupled from the concrete (Zustand) store.
 * Presentation adapts the store to this interface when wiring use cases.
 */
export interface ActorWorkspaceGateway {
  isInWorkspace(actorId: string): boolean;
  addToWorkspace(actor: ActorRef): void;
  selectActor(actorId: string | null): void;
}
