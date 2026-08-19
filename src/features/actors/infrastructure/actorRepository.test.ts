import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { BffError, bffRequest } from "@/infrastructure/bff/client";
import { ActorSource, ActorType } from "../domain/actor.types";
import { configureAdmin, createActor, discoverActors } from "./actorRepository";

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

  it("forwards the environment and requested types to the BFF", async () => {
    mockedRequest.mockResolvedValue([
      { id: "11", type: ActorType.Bus, label: "ABC" },
    ]);

    const result = await discoverActors({
      envId: BackendEnvId.Local,
      types: [ActorType.Passenger, ActorType.Driver, ActorType.Bus],
    });

    expect(result.status).toBe("success");
    expect(result).toMatchObject({
      status: "success",
      actors: [{ id: "11", type: ActorType.Bus }],
    });
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/wusool/actors/search",
      {
        env: { envId: "local", baseUrl: undefined },
        types: [ActorType.Passenger, ActorType.Driver, ActorType.Bus],
      },
      { signal: undefined },
    );
  });

  it("rejects an unknown environment", async () => {
    const result = await discoverActors({
      envId: "nope",
      types: [ActorType.Passenger],
    });

    expect(result.status).toBe("failure");
    if (result.status !== "failure") throw new Error("expected failure");
    expect(result.error.code).toBe("ENVIRONMENT");
  });

  it("surfaces a BFF failure with its code and status", async () => {
    const error = new BffError(401, "Admin auth", "ADMIN_AUTH_REQUIRED");
    mockedRequest.mockRejectedValue(error);

    const result = await discoverActors({
      envId: BackendEnvId.Local,
      types: [ActorType.Passenger],
    });

    expect(result).toMatchObject({
      status: "failure",
      error: { code: "ADMIN_AUTH_REQUIRED", message: "Admin auth" },
    });
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

    const actor = await createActor(env, {
      type: ActorType.Passenger,
      email: "p@x",
      password: "pass123",
      name: "Passenger",
    });

    expect(mockedRequest).toHaveBeenCalledWith("/api/wusool/actors", {
      env: { envId: "local", baseUrl: undefined },
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

describe("configureAdmin", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("submits credentials to the admin login route", async () => {
    mockedRequest.mockResolvedValue({ configured: true });

    await configureAdmin(env, {
      mode: "credentials",
      email: "admin@x",
      password: "secret",
    });

    expect(mockedRequest).toHaveBeenCalledWith("/api/wusool/admin/login", {
      env: { envId: "local", baseUrl: undefined },
      mode: "credentials",
      email: "admin@x",
      password: "secret",
    });
  });

  it("submits a pasted token to the admin login route", async () => {
    mockedRequest.mockResolvedValue({ configured: true });

    await configureAdmin(env, { mode: "token", token: "jwt-abc" });

    expect(mockedRequest).toHaveBeenCalledWith("/api/wusool/admin/login", {
      env: { envId: "local", baseUrl: undefined },
      mode: "token",
      token: "jwt-abc",
    });
  });
});
