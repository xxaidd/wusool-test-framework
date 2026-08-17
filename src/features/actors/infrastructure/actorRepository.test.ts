import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { apiRequest } from "@/infrastructure/http/WusoolApiClient";
import { ActorType } from "../domain/actor.types";
import { createActor, discoverActors } from "./actorRepository";
import { registerPassenger } from "./authService";

vi.mock("@/infrastructure/http/WusoolApiClient", async (importActual) => {
  const actual =
    await importActual<
      typeof import("@/infrastructure/http/WusoolApiClient")
    >();
  return { ...actual, apiRequest: vi.fn() };
});

vi.mock("./authService", async (importActual) => {
  const actual = await importActual<typeof import("./authService")>();
  return { ...actual, registerPassenger: vi.fn() };
});

const env: BackendEnvironment = {
  id: BackendEnvId.Local,
  label: "Local",
  baseUrl: "http://localhost:5002",
};

const mockedRequest = vi.mocked(apiRequest);
const mockedRegister = vi.mocked(registerPassenger);

describe("discoverActors", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("maps buses and users into actors", async () => {
    mockedRequest.mockImplementation(async (_env, path) => {
      if (path === "/api/v1/buses") {
        return { items: [{ id: 11, plateNumber: "ABC" }] };
      }
      if (path === "/api/v1/admin/users") {
        return {
          items: [
            { id: 1, fullName: "Alice", role: "passenger", email: "a@x" },
            { id: 2, fullName: "Bob", role: "driver", email: "b@x" },
          ],
        };
      }
      return {};
    });

    const actors = await discoverActors(env, "admin-token", [
      ActorType.Passenger,
      ActorType.Driver,
      ActorType.Bus,
    ]);

    expect(actors).toHaveLength(3);
    expect(actors.find((a) => a.id === "11")).toMatchObject({
      type: ActorType.Bus,
      label: "ABC",
    });
    expect(actors.find((a) => a.id === "1")).toMatchObject({
      type: ActorType.Passenger,
      label: "Alice",
    });
    expect(actors.find((a) => a.id === "2")).toMatchObject({
      type: ActorType.Driver,
      label: "Bob",
    });
  });

  it("filters actors by requested types", async () => {
    mockedRequest.mockImplementation(async (_env, path) => {
      if (path === "/api/v1/admin/users") {
        return {
          items: [
            { id: 1, fullName: "Alice", role: "passenger" },
            { id: 2, fullName: "Bob", role: "driver" },
          ],
        };
      }
      return { items: [] };
    });

    const actors = await discoverActors(env, "admin-token", [ActorType.Driver]);
    expect(actors).toHaveLength(1);
    expect(actors[0].id).toBe("2");
  });
});

describe("createActor", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
    mockedRegister.mockReset();
  });

  it("creates a passenger via registration and authenticates immediately", async () => {
    mockedRegister.mockResolvedValue({
      tokens: { accessToken: "tok", refreshToken: "rt" },
      userId: "u1",
    });

    const actor = await createActor(env, "admin-token", {
      type: ActorType.Passenger,
      email: "p@x",
      password: "pass123",
      name: "Passenger",
    });

    expect(mockedRegister).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ email: "p@x", password: "pass123" }),
    );
    expect(actor).toMatchObject({
      id: "u1",
      type: ActorType.Passenger,
      token: "tok",
      authenticated: true,
      source: "test",
    });
  });

  it("creates a driver via the admin endpoint", async () => {
    mockedRequest.mockResolvedValue({ driverId: 9 });

    const actor = await createActor(env, "admin-token", {
      type: ActorType.Driver,
      email: "d@x",
      password: "pass123",
      name: "Driver",
    });

    expect(mockedRequest).toHaveBeenCalledWith(
      env,
      "/api/v1/admin/drivers",
      expect.objectContaining({ method: "POST", token: "admin-token" }),
    );
    expect(actor).toMatchObject({ id: "9", type: ActorType.Driver });
  });

  it("creates a bus via the admin endpoint", async () => {
    mockedRequest.mockResolvedValue({ id: 3 });

    const actor = await createActor(env, "admin-token", {
      type: ActorType.Bus,
      plateNumber: "XYZ",
      capacityNumber: 40,
    });

    expect(mockedRequest).toHaveBeenCalledWith(
      env,
      "/api/v1/buses",
      expect.objectContaining({ method: "POST" }),
    );
    expect(actor).toMatchObject({ id: "3", type: ActorType.Bus, label: "XYZ" });
  });
});
