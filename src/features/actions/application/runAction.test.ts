import { describe, expect, it, vi } from "vitest";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import { ActorSource, ActorType } from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { getAction } from "./actionCatalog";
import type { ActionRepositoryResult } from "./actionRepository";
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
  result: ActionRepositoryResult,
  execute = vi.fn().mockResolvedValue(result),
) {
  return { execute };
}

describe("runAction", () => {
  it("executes a successful action and shapes the outcome", async () => {
    const repo = repoReturning({ ok: true, status: 201, data: { id: 42 } });
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
    expect(outcome.request.url).toBe(
      "http://localhost:5002/api/v1/bus-trips/42/start?id=42",
    );
    expect(outcome.request.headers.Authorization).toBe("Bearer •••");
    expect(outcome.response?.status).toBe(201);
    expect(JSON.parse(outcome.response?.body ?? "")).toEqual({ id: 42 });
    expect(repo.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/v1/bus-trips/42/start",
        method: "POST",
        token: "secret-token",
        data: { id: "42" },
      }),
    );
  });

  it("normalizes a failed action", async () => {
    const outcome = await runAction({
      env,
      actor,
      action: mustGet("driver.startTrip"),
      args: { id: "42" },
      token: "secret-token",
      repo: repoReturning({ ok: false, status: 500, error: "boom" }),
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.statusCode).toBe(500);
    expect(outcome.error).toBe("boom");
    expect(outcome.response?.body).toBe("boom");
  });

  it("returns needsAuth without calling the repository", async () => {
    const execute = vi.fn();
    const outcome = await runAction({
      env,
      actor,
      action: mustGet("driver.startTrip"),
      args: { id: "42" },
      repo: { execute },
    });

    expect(outcome.needsAuth).toBe(true);
    expect(outcome.ok).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it("carries position through to the outcome", async () => {
    const outcome = await runAction({
      env,
      actor,
      action: mustGet("passenger.discoverTrips"),
      args: {},
      repo: repoReturning({ ok: true, status: 200, data: [] }),
      position: { lat: 24.7, lng: 46.6 },
    });
    expect(outcome.position).toEqual({ lat: 24.7, lng: 46.6 });
  });
});
