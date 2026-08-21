import { beforeEach, describe, expect, it } from "vitest";
import { ActorSource, ActorType } from "@/features/actors/domain/actor.types";
import { safeActor } from "@/infrastructure/bff/client";
import { useActorStore } from "@/shared/store/actor.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { useEnvironmentStore } from "@/shared/store/environment.store";

const SECRET_KEY_RE =
  /("(?:password|passwd|token|accessToken|refreshToken|credentials)"\s*:)/i;

function stateSnapshot(value: unknown): string {
  return JSON.stringify(value);
}

function localStorageValue(name: string): string {
  return globalThis.localStorage.getItem(name) ?? "";
}

function sessionStorageValue(name: string): string {
  return globalThis.sessionStorage.getItem(name) ?? "";
}

describe("auth security surface", () => {
  beforeEach(() => {
    useActorStore.setState({
      workspace: [],
      discovered: [],
      selectedActorId: null,
      search: "",
      typeFilter: "all",
      placed: [],
    });
    useAuthStore.setState({ authenticated: {}, emails: {} });
  });

  it("workspace actors never carry credentials or tokens", () => {
    const discovered = {
      id: "7",
      type: ActorType.Passenger,
      label: "Passenger 7",
      sublabel: "p7@example.com",
      authenticated: false,
      source: ActorSource.Existing,
      raw: { id: 7, email: "p7@example.com" },
    };
    useActorStore.getState().addToWorkspace(discovered);

    const created = {
      id: "u1",
      type: ActorType.Passenger,
      label: "Passenger",
      sublabel: "u1@example.com",
      authenticated: true,
      source: ActorSource.Test,
      raw: { email: "u1@example.com", userId: "u1" },
    };
    useActorStore.getState().addToWorkspace(created);

    const state = stateSnapshot(useActorStore.getState());
    const persisted = localStorageValue("wusool-actors");

    expect(state).not.toMatch(SECRET_KEY_RE);
    expect(persisted).not.toMatch(SECRET_KEY_RE);
  });

  it("the JIT-auth and sign-out flows never persist secrets", () => {
    const actor = {
      id: "u1",
      type: ActorType.Passenger,
      label: "Passenger",
      sublabel: "u1@example.com",
      authenticated: false,
      source: ActorSource.Test,
    };
    useActorStore.getState().addToWorkspace(actor);

    // Replicates App.tsx onAuthSuccess after a successful modal login.
    useAuthStore.getState().setAuthenticated(actor.id, "u1@example.com");
    useActorStore.getState().updateActor(actor.id, { authenticated: true });

    // Replicates ActorPanel onSignOut.
    useAuthStore.getState().clear(actor.id);
    useActorStore.getState().updateActor(actor.id, { authenticated: false });

    const actorState = stateSnapshot(useActorStore.getState());
    const authState = stateSnapshot(useAuthStore.getState());
    const persistedActor = localStorageValue("wusool-actors");

    for (const payload of [actorState, authState, persistedActor]) {
      expect(payload).not.toMatch(SECRET_KEY_RE);
    }
  });

  it("the auth store is in-memory only and never persisted", () => {
    // Mirrors the vault: ephemeral auth state must not survive a reload.
    expect(sessionStorageValue("wusool-auth")).toBe("");
    expect(localStorageValue("wusool-auth")).toBe("");
  });

  it("auth store holds only booleans and display emails", () => {
    useAuthStore.getState().setAuthenticated("a1", "a1@example.com");
    const state = useAuthStore.getState();

    expect(state.authenticated.a1).toBe(true);
    expect(state.emails.a1).toBe("a1@example.com");
    expect(stateSnapshot(state)).not.toMatch(SECRET_KEY_RE);
  });

  it("safeActor projects away raw backend snapshots", () => {
    const actor = {
      id: "7",
      type: ActorType.Driver,
      label: "Driver 7",
      sublabel: "d7@example.com",
      authenticated: true,
      source: ActorSource.Existing,
      raw: { id: 7, email: "d7@example.com", role: "driver" },
    };
    const safe = safeActor(actor);

    expect(stateSnapshot(safe)).not.toContain("raw");
    expect(safe).toMatchObject({
      id: "7",
      type: ActorType.Driver,
      label: "Driver 7",
      authenticated: true,
    });
  });

  it("the persisted environment payload never contains admin configuration", () => {
    useEnvironmentStore.setState({ adminConfigured: true });

    const payload = sessionStorageValue("wusool-environment");

    expect(payload).not.toMatch(/"adminConfigured"\s*:/);
    expect(payload).not.toMatch(/"adminToken"\s*:/);
    expect(payload).not.toContain("admin-jwt-secret");
  });
});
