import type { ActorWorkspaceGateway } from "./ActorWorkspaceGateway";

/**
 * Use case for selecting an actor in the workspace.
 * Delegates to the injected workspace gateway. Selection uses the typed
 * workspace key so a colliding raw id across types cannot overlap.
 */
export class SelectActorUseCase {
  constructor(private readonly workspace: ActorWorkspaceGateway) {}

  execute(actorKey: string | null): void {
    this.workspace.selectActor(actorKey);
  }
}
