import { describe, expect, it, vi } from "vitest";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import { ActorSource, ActorType } from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { ValidationError } from "@/shared/errors";
import { getAction } from "./actionCatalog";
import type { ActionResult } from "./actionRepository";
import { executeAction } from "./executeAction";

const env: BackendEnvironment = {
  id: BackendEnvId.Local,
  label: "Local",
  baseUrl: "http://localhost:5002",
};

const actor: ActorRef = {
  id: "7",
  type: ActorType.Passenger,
  label: "Passenger 7",
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

describe("executeAction", () => {
  it("assigns a unique execution id and normalizes a successful outcome", async () => {
    const repo = repoReturning({
      status: "success",
      statusCode: 201,
      data: { id: 184 },
      correlation: { traceId: "trace-1" },
      request: {
        method: "POST",
        path: "/api/v1/user-trips/reserve",
        query: {},
        headers: {},
        body: "{}",
      },
      response: { statusCode: 201, headers: {}, body: '{"id":184}' },
    });
    const first = await executeAction({
      env,
      actor,
      action: mustGet("passenger.reserve"),
      args: { busTripId: "184", boardingStopId: "20", alightingStopId: "30" },
      token: "secret-token",
      repo,
    });
    const second = await executeAction({
      env,
      actor,
      action: mustGet("passenger.reserve"),
      args: { busTripId: "185", boardingStopId: "21", alightingStopId: "31" },
      token: "secret-token",
      repo,
    });

    expect(first.executionId).toMatch(/^exec_/);
    expect(first.executionId).not.toBe(second.executionId);
    expect(first.ok).toBe(true);
    expect(first.needsAuth).toBe(false);
    expect(first.statusCode).toBe(201);
    expect(first.data).toEqual({ id: 184 });
    expect(first.correlation).toEqual({ traceId: "trace-1" });
    expect(first.summary.key).toBe("result.passenger.reserved");
    expect(repo.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actor,
        action: expect.objectContaining({
          metadata: expect.objectContaining({ id: "passenger.reserve" }),
        }),
        args: { busTripId: "184", boardingStopId: "20", alightingStopId: "30" },
        token: "secret-token",
      }),
    );
  });

  it("builds a sanitized preview with redacted authorization header", async () => {
    const repo = repoReturning({
      status: "success",
      statusCode: 200,
      data: [],
      correlation: {},
    });
    const outcome = await executeAction({
      env,
      actor,
      action: mustGet("passenger.myBookings"),
      args: {},
      token: "secret-token",
      repo,
    });
    // No repo evidence returned → falls back to the local preview.
    expect(outcome.request.path).toBe("/api/v1/user-trips/me");
    expect(outcome.request.headers.Authorization).toBe("Bearer •••");
    expect(outcome.response?.statusCode).toBe(200);
  });

  it("rejects invalid inputs in normal mode without touching the repo", async () => {
    const repo = repoReturning({
      status: "success",
      statusCode: 200,
      data: {},
      correlation: {},
    });
    await expect(
      executeAction({
        env,
        actor,
        action: mustGet("passenger.reserve"),
        args: { busTripId: "10" },
        repo,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repo.execute).not.toHaveBeenCalled();
  });

  it("advanced invalid-test mode bypasses normal validation but still shapes evidence", async () => {
    const repo = repoReturning({
      status: "failure",
      classification: { kind: "business" },
      statusCode: 400,
      message: "reserve failed",
      correlation: { correlationId: "req_1" },
    });
    const outcome = await executeAction({
      env,
      actor,
      action: mustGet("passenger.reserve"),
      args: { busTripId: "10" },
      repo,
      mode: "invalid",
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.statusCode).toBe(400);
    // The deliberately-invalid request is still recorded as evidence, not a UI exception.
    expect(outcome.summary.key).toBe("result.actionFailed");
    expect(repo.execute).toHaveBeenCalled();
  });

  it("normalizes a failed backend action without retrying it", async () => {
    const repo = repoReturning({
      status: "failure",
      classification: { kind: "business" },
      statusCode: 422,
      message: "cannot cancel: already started",
      correlation: {},
    });
    const outcome = await executeAction({
      env,
      actor,
      action: mustGet("passenger.cancelBooking"),
      args: { id: "9", reason: "plans" },
      repo,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.statusCode).toBe(422);
    expect(outcome.error).toBe("cannot cancel: already started");
    expect(outcome.response?.body).toBe("cannot cancel: already started");
    expect(repo.execute).toHaveBeenCalledTimes(1);
  });

  it("surfaces needs-auth without treating it as a fatal error", async () => {
    const repo = repoReturning({ status: "needs-auth", correlation: {} });
    const outcome = await executeAction({
      env,
      actor,
      action: mustGet("passenger.myBookings"),
      args: {},
      repo,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.needsAuth).toBe(true);
    expect(outcome.statusCode).toBe(401);
    expect(outcome.summary.key).toBe("action.authRequired");
  });

  it("refreshes the required backend state before executing", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const outcome = await executeAction({
      env,
      actor,
      action: mustGet("passenger.cancelBooking"),
      args: { id: "9" },
      repo: repoReturning({
        status: "success",
        statusCode: 200,
        data: { id: 9 },
        correlation: {},
      }),
      refresh,
    });
    expect(outcome.refreshed).toBe(true);
    expect(refresh).toHaveBeenCalledWith(expect.arrayContaining(["booking"]));
  });

  it("records a refresh failure without blocking the action", async () => {
    const refresh = vi.fn().mockRejectedValue(new Error("vault unavailable"));
    const outcome = await executeAction({
      env,
      actor,
      action: mustGet("passenger.myBookings"),
      args: {},
      repo: repoReturning({
        status: "success",
        statusCode: 200,
        data: [],
        correlation: {},
      }),
      refresh,
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.refreshed).toBe(false);
    expect(outcome.refreshError).toBe("vault unavailable");
  });
});
