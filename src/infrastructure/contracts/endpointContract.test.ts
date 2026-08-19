import { describe, expect, it } from "vitest";
import {
  actions,
  verifiedActionsForActor,
} from "@/features/actions/application/actionCatalog";
import { ActorType } from "@/features/actors/domain/actor.types";
import {
  endpointContracts,
  getEndpointContract,
  getVerifiedEndpointContract,
  verifiedEndpointContracts,
} from "./endpointContract";

describe("endpointContract registry", () => {
  it("registers unique action ids", () => {
    const ids = endpointContracts.map((c) => c.actionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves every catalog action id (verified or not)", () => {
    for (const action of actions) {
      expect(getEndpointContract(action.contractRef), action.id).toBeDefined();
    }
  });

  it("every verified ActionDef resolves to a verified EndpointContract", () => {
    for (const action of actions) {
      if (!action.verified) continue;
      const contract = getVerifiedEndpointContract(action.contractRef);
      expect(contract, `${action.id} has no verified contract`).toBeDefined();
      expect(contract?.verified).toBe(true);
      expect(contract?.method).toBe(action.method);
    }
  });

  it("every verified contract points to a verified action (when an action exists)", () => {
    const actionById = new Map(actions.map((a) => [a.id, a]));
    for (const contract of verifiedEndpointContracts()) {
      const action = actionById.get(contract.actionId);
      if (action) {
        expect(action.verified, `${contract.actionId}`).toBe(true);
      }
    }
  });

  it("no verified:false action is executable for any actor type", () => {
    for (const type of Object.values(ActorType)) {
      const executable = verifiedActionsForActor(type);
      expect(executable.every((a) => a.verified)).toBe(true);
      expect(executable.length).toBeGreaterThan(0);
    }
  });

  it("all unverified catalog entries are Driver/Bus actions", () => {
    const unverified = actions.filter((a) => !a.verified);
    expect(unverified.length).toBeGreaterThan(0);
    for (const action of unverified) {
      expect(
        action.actorTypes.includes(ActorType.Driver) ||
          action.actorTypes.includes(ActorType.Bus),
        `${action.id} should be a Driver/Bus action to be unverified`,
      ).toBe(true);
    }
  });
});
