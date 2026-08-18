import { describe, expect, it, vi } from "vitest";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import { ActorSource, ActorType } from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { getAction } from "./actionCatalog";
import type { ActionResult } from "./actionRepository";
import { runAction } from "./runAction";

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

function mustGet(id: string) {
  const action = getAction(id);
  if (!action) throw new Error(`missing action: ${id}`);
  return action;
}

function repoReturning(
  result: ActionResult,
  execute = vi.fn().mockResolvedValue(result),
) {
  return { execute };
}

describe("runAction", () => {
  it("executes a successful action and shapes the outcome", async () => {
    const repo = repoReturning({
      status: "success",
      statusCode: 201,
      data: { id: 42 },
      correlation: { traceId: "trace-1" },
      request: {
        method: "POST",
        path: "/api/v1/bus-trips/42/start",
        query: { id: "42" },
        headers: {},
        body: "{}",
      },
      response: {
        statusCode: 201,
        headers: {},
        body: '{"id":42}',
      },
    });
    const outcome = await runAction({
      env,
      actor,
      action: mustGet("driver.startTrip"),
      args: { id: "42" },
      token: "secret-token",
      repo,
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.needsAuth).toBe(false);
    expect(outcome.statusCode).toBe(201);
    expect(outcome.data).toEqual({ id: 42 });
    expect(outcome.correlation).toEqual({ traceId: "trace-1" });
    expect(outcome.request.path).toBe("/api/v1/bus-trips/42/start");
    expect(outcome.response?.statusCode).toBe(201);
    expect(JSON.parse(outcome.response?.body ?? "")).toEqual({ id: 42 });
    expect(repo.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actor,
        action: expect.objectContaining({ id: "driver.startTrip" }),
        args: { id: "42" },
        token: "secret-token",
      }),
    );
  });

  it("falls back to the local preview when the repository returns no evidence", async () => {
    const repo = repoReturning({
      status: "success",
      statusCode: 201,
      data: { id: 42 },
      correlation: {},
    });
    const outcome = await runAction({
      env,
      actor,
      action: mustGet("driver.startTrip"),
      args: { id: "42" },
      token: "secret-token",
      repo,
    });

    expect(outcome.request.path).toBe("/api/v1/bus-trips/42/start");
    expect(outcome.request.query).toEqual({ id: "42" });
    expect(outcome.request.headers.Authorization).toBe("Bearer •••");
    expect(outcome.response?.statusCode).toBe(201);
    expect(JSON.parse(outcome.response?.body ?? "")).toEqual({ id: 42 });
  });

  it("normalizes a failed action", async () => {
    const outcome = await runAction({
      env,
      actor,
      action: mustGet("driver.startTrip"),
      args: { id: "42" },
      token: "secret-token",
      repo: repoReturning({
        status: "failure",
        classification: {
          kind: "infrastructure",
          subtype: "backend-unavailable",
        },
        statusCode: 500,
        message: "boom",
        correlation: {},
      }),
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.statusCode).toBe(500);
    expect(outcome.error).toBe("boom");
    expect(outcome.response?.body).toBe("boom");
  });

  it("surfaces a backend needs-auth result without treating it as a fatal error", async () => {
    const repo = repoReturning({ status: "needs-auth", correlation: {} });
    const outcome = await runAction({
      env,
      actor,
      action: mustGet("driver.startTrip"),
      args: { id: "42" },
      repo,
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.needsAuth).toBe(true);
    expect(outcome.statusCode).toBe(401);
    expect(repo.execute).toHaveBeenCalled();
  });

  it("carries position through to the outcome", async () => {
    const outcome = await runAction({
      env,
      actor,
      action: mustGet("passenger.discoverTrips"),
      args: {},
      repo: repoReturning({
        status: "success",
        statusCode: 200,
        data: [],
        correlation: {},
      }),
      position: { lat: 24.7, lng: 46.6 },
    });
    expect(outcome.position).toEqual({ lat: 24.7, lng: 46.6 });
  });
});
