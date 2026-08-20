import {
  type ActorRef,
  actorWorkspaceKeyOf,
} from "@/features/actors/domain/actor.types";
import type { ActorWorkspaceGateway } from "./ActorWorkspaceGateway";

/**
 * Use case for adding an actor to the testing workspace.
 * Prevents duplicates and delegates to the injected workspace gateway.
 * Deduplication uses the typed workspace key, so actors whose raw backend id
 * collides across types remain distinct.
 */
export class AddActorToWorkspaceUseCase {
  constructor(private readonly workspace: ActorWorkspaceGateway) {}

  execute(actor: ActorRef): void {
    if (this.workspace.isInWorkspace(actorWorkspaceKeyOf(actor))) return;
    this.workspace.addToWorkspace(actor);
  }
}
