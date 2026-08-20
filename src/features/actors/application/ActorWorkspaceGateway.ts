import type { ActorRef } from "@/features/actors/domain/actor.types";

/**
 * Application-facing port over the test actors workspace.
 *
 * Keeps the Application layer decoupled from the concrete (Zustand) store.
 * Presentation adapts the store to this interface when wiring use cases.
 */
export interface ActorWorkspaceGateway {
  /** `actorKey` is the typed stable workspace identity (see actorWorkspaceKeyOf). */
  isInWorkspace(actorKey: string): boolean;
  addToWorkspace(actor: ActorRef): void;
  selectActor(actorKey: string | null): void;
}
