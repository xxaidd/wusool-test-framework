/**
 * Versioned Wusool API compatibility contract (Task 0.2).
 *
 * Pure TypeScript — no React, Next.js, Zustand, browser APIs, HTTP clients,
 * or map libraries. Kept free of framework imports so Task 0.3 boundaries
 * stay clean. See `docs/contracts/wusool-api-v1.md` for the source contract.
 */

export type {
  EndpointAuth,
  EndpointContract,
  EndpointMethod,
} from "./endpointContract";
export {
  endpointContracts,
  getEndpointContract,
  getVerifiedEndpointContract,
  verifiedEndpointContracts,
} from "./endpointContract";
export * from "./mappers";
export * from "./schemas/actor";
export * from "./schemas/apiResponse";
export * from "./schemas/auth";
export * from "./schemas/commands";
export * from "./schemas/entity";
export * from "./schemas/enums";
export * from "./schemas/errorResponse";
