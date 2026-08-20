import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAction } from "@/features/actions/application/actionCatalog";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import { ActorSource, ActorType } from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { createServerActionRepository } from "./serverActionRepository";
import { serverRequest } from "./wusoolServerClient";

vi.mock("@/infrastructure/server/wusoolServerClient", async (importActual) => {
  const actual = await importActual<typeof import("./wusoolServerClient")>();
  return { ...actual, serverRequest: vi.fn() };
});

const env: BackendEnvironment = {
  id: BackendEnvId.Local,
  label: "Local",
  baseUrl: "http://localhost:5002",
};

const actor: ActorRef = {
  id: "7",
  type: ActorType.Driver,
  label: "Driver 7",
  authenticated: true,
  source: ActorSource.Existing,
  raw: { id: 7 },
};

const mockedServerRequest = vi.mocked(serverRequest);
const repo = createServerActionRepository("req_1");

function mustGet(id: string) {
  const action = getAction(id);
  if (!action) throw new Error(`missing action: ${id}`);
  return action;
}

describe("createServerActionRepository", () => {
  beforeEach(() => {
    mockedServerRequest.mockReset();
  });

  it("builds the request from the action and returns sanitized success evidence", async () => {
    mockedServerRequest.mockResolvedValue({
      status: 201,
      data: { id: 42 },
      headers: { "x-trace-id": "trace-1" },
    });

    const result = await repo.execute({
      env,
      actor,
      action: mustGet("driver.startTrip"),
      args: { id: "42" },
      token: "tok",
    });

    expect(mockedServerRequest).toHaveBeenCalledWith(
      env,
      "/api/v1/bus-trips/42/start",
      expect.objectContaining({
        method: "POST",
        token: "tok",
        // selector `id` stays in the path only; it is not duplicated into the body.
        data: {},
        correlationId: "req_1",
      }),
    );
    expect(result).toMatchObject({
      status: "success",
      statusCode: 201,
      data: { id: 42 },
      correlation: { correlationId: "req_1", traceId: "trace-1" },
    });
    if (result.status === "success") {
      expect(result.request?.path).toBe("/api/v1/bus-trips/42/start");
      // `id` is a path selector, not a query param — not duplicated.
      expect(result.request?.query).toBeUndefined();
      expect(result.response?.statusCode).toBe(201);
    }
  });

  it("redacts tokens in evidence", async () => {
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: { accessToken: "secret", id: 1 },
      headers: {},
    });

    const result = await repo.execute({
      env,
      actor,
      action: mustGet("driver.startTrip"),
      args: { id: "42" },
      token: "tok",
    });

    if (result.status === "success") {
      expect(result.data).toEqual({ accessToken: "••••••••", id: 1 });
      const body = JSON.parse(result.response?.body ?? "{}");
      expect(body.accessToken).toBe("••••••••");
      expect(body.id).toBe(1);
    }
  });

  it("maps 401 to needs-auth with sanitized evidence", async () => {
    mockedServerRequest.mockRejectedValue(
      new (await import("./wusoolServerClient")).ServerApiError(
        401,
        "unauthorized",
      ),
    );

    const result = await repo.execute({
      env,
      actor,
      action: mustGet("driver.startTrip"),
      args: { id: "42" },
    });

    expect(result).toEqual({
      status: "needs-auth",
      correlation: { correlationId: "req_1" },
      request: expect.any(Object),
      response: expect.any(Object),
    });
  });

  it("classifies backend failures", async () => {
    mockedServerRequest.mockRejectedValue(
      new (await import("./wusoolServerClient")).ServerApiError(
        404,
        "not found",
      ),
    );

    const result = await repo.execute({
      env,
      actor,
      action: mustGet("driver.startTrip"),
      args: { id: "42" },
    });

    expect(result).toMatchObject({
      status: "failure",
      classification: { kind: "business" },
      statusCode: 404,
      message: "not found",
    });
  });

  it("does not attach an authorization header when no token is present", async () => {
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: {},
      headers: {},
    });

    await repo.execute({
      env,
      actor,
      action: mustGet("general.listStops"),
      args: {},
    });

    expect(mockedServerRequest).toHaveBeenCalledWith(
      env,
      "/api/v1/stops",
      expect.objectContaining({ token: undefined }),
    );
  });
});
