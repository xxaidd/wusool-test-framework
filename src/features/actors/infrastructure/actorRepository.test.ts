import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { bffRequest } from "@/infrastructure/bff/client";
import { ActorSource, ActorType } from "../domain/actor.types";
import { createActor, discoverActors } from "./actorRepository";

vi.mock("@/infrastructure/bff/client", async (importActual) => {
  const actual =
    await importActual<typeof import("@/infrastructure/bff/client")>();
  return { ...actual, bffRequest: vi.fn() };
});

const env: BackendEnvironment = {
  id: BackendEnvId.Local,
  label: "Local",
  baseUrl: "http://localhost:5002",
};

const mockedRequest = vi.mocked(bffRequest);

describe("discoverActors", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("forwards the environment, admin token, and requested types to the BFF", async () => {
    mockedRequest.mockResolvedValue([
      { id: "11", type: ActorType.Bus, label: "ABC" },
    ]);

    const actors = await discoverActors(env, "admin-token", [
      ActorType.Passenger,
      ActorType.Driver,
      ActorType.Bus,
    ]);

    expect(mockedRequest).toHaveBeenCalledWith("/api/wusool/actors/search", {
      env: { envId: "local", baseUrl: undefined },
      adminToken: "admin-token",
      types: [ActorType.Passenger, ActorType.Driver, ActorType.Bus],
    });
    expect(actors).toHaveLength(1);
    expect(actors[0]).toMatchObject({ id: "11", type: ActorType.Bus });
  });
});

describe("createActor", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("creates a passenger through the BFF", async () => {
    mockedRequest.mockResolvedValue({
      id: "u1",
      type: ActorType.Passenger,
      label: "Passenger",
      sublabel: "p@x",
      authenticated: true,
      source: ActorSource.Test,
      raw: { email: "p@x" },
    });

    const actor = await createActor(env, "admin-token", {
      type: ActorType.Passenger,
      email: "p@x",
      password: "pass123",
      name: "Passenger",
    });

    expect(mockedRequest).toHaveBeenCalledWith("/api/wusool/actors", {
      env: { envId: "local", baseUrl: undefined },
      adminToken: "admin-token",
      input: {
        type: ActorType.Passenger,
        email: "p@x",
        password: "pass123",
        name: "Passenger",
      },
    });
    expect(actor).toMatchObject({
      id: "u1",
      type: ActorType.Passenger,
      authenticated: true,
    });
  });
});
