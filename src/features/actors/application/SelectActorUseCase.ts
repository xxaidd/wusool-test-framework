import type { ActorWorkspaceGateway } from "./ActorWorkspaceGateway";

/**
 * Use case for selecting an actor in the workspace.
 * Delegates to the injected workspace gateway.
 */
export class SelectActorUseCase {
  constructor(private readonly workspace: ActorWorkspaceGateway) {}

  execute(actorId: string | null): void {
    this.workspace.selectActor(actorId);
  }
}
