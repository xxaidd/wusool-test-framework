export type {
  ActorRepository,
  CreateActorInput,
  CreateActorResult,
  DiscoverActorsInput,
  DiscoverActorsResult,
  SafeActor,
} from "./application/ActorRepository";
export {
  actorTypeSchema,
  discoverActorsInputSchema,
} from "./application/ActorRepository";
export type {
  AuthContext,
  CredentialVault,
} from "./application/CredentialVault";
export * from "./domain/actor.types";
export * from "./domain/auth.types";
export { createActor, discoverActors } from "./infrastructure/actorRepository";
export { login } from "./infrastructure/authService";
