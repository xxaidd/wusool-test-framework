import type { ActorRef } from "@/features/actors/domain/actor.types";
import type { ActorWorkspaceGateway } from "./ActorWorkspaceGateway";

/**
 * Use case for adding an actor to the testing workspace.
 * Prevents duplicates and delegates to the injected workspace gateway.
 */
export class AddActorToWorkspaceUseCase {
  constructor(private readonly workspace: ActorWorkspaceGateway) {}

  execute(actor: ActorRef): void {
    if (this.workspace.isInWorkspace(actor.id)) return;
    this.workspace.addToWorkspace(actor);
  }
}
