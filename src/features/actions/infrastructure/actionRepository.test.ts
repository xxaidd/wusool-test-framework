import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorRef } from "@/features/actors/domain/actor.types";
import { ActorSource, ActorType } from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { BffError, bffRequest } from "@/infrastructure/bff/client";
import { getAction } from "../application/actionCatalog";
import type { ExecuteEnvelope } from "./actionRepository";
import { bffActionRepository } from "./actionRepository";

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

const actor: ActorRef = {
  id: "7",
  type: ActorType.Driver,
  label: "Driver 7",
  authenticated: true,
  source: ActorSource.Existing,
  raw: { id: 7 },
};

const mockedRequest = vi.mocked(bffRequest);

function mustGet(id: string) {
  const action = getAction(id);
  if (!action) throw new Error(`missing action: ${id}`);
  return action;
}

function envelope(result: Partial<ExecuteEnvelope>): ExecuteEnvelope {
  return {
    ok: true,
    needsAuth: false,
    statusCode: 200,
    durationMs: 10,
    ...result,
  };
}

describe("bffActionRepository", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("returns a success result on success", async () => {
    mockedRequest.mockResolvedValue(
      envelope({ ok: true, statusCode: 201, data: { id: 1 } }),
    );
    const result = await bffActionRepository.execute({
      env,
      actor: { ...actor, raw: undefined },
      action: mustGet("driver.startTrip"),
      args: { id: "1" },
    });
    expect(result).toEqual({
      status: "success",
      statusCode: 201,
      data: { id: 1 },
      correlation: {},
    });
  });

  it("maps a needs-auth envelope to needs-auth", async () => {
    mockedRequest.mockResolvedValue(envelope({ ok: false, needsAuth: true }));
    const result = await bffActionRepository.execute({
      env,
      actor: { ...actor, raw: undefined },
      action: mustGet("driver.startTrip"),
      args: {},
    });
    expect(result).toEqual({ status: "needs-auth", correlation: {} });
  });

  it("maps a failure envelope with classification", async () => {
    mockedRequest.mockResolvedValue(
      envelope({ ok: false, statusCode: 404, error: "not found" }),
    );
    const result = await bffActionRepository.execute({
      env,
      actor: { ...actor, raw: undefined },
      action: mustGet("driver.startTrip"),
      args: {},
    });
    expect(result).toMatchObject({
      status: "failure",
      classification: { kind: "business" },
      statusCode: 404,
      message: "not found",
    });
  });

  it("turns a backend-unavailable BffError into a recorded failure outcome", async () => {
    mockedRequest.mockRejectedValue(
      new BffError(502, "Backend unreachable", "BACKEND_UNAVAILABLE"),
    );
    const result = await bffActionRepository.execute({
      env,
      actor: { ...actor, raw: undefined },
      action: mustGet("driver.startTrip"),
      args: {},
    });
    expect(result).toMatchObject({
      status: "failure",
      classification: {
        kind: "infrastructure",
        subtype: "backend-unavailable",
      },
      statusCode: 502,
      message: "Backend unreachable",
    });
  });

  it("classifies a plain network failure without a BffError", async () => {
    mockedRequest.mockRejectedValue(new Error("Network Error"));
    const result = await bffActionRepository.execute({
      env,
      actor: { ...actor, raw: undefined },
      action: mustGet("driver.startTrip"),
      args: {},
    });
    expect(result.status).toBe("failure");
    if (result.status === "failure") {
      expect(result.classification).toMatchObject({
        kind: "infrastructure",
        subtype: "backend-unavailable",
      });
      expect(result.message).toBe("Network Error");
    }
  });

  it("rethrows cancellation so callers can distinguish it", async () => {
    const abort = new DOMException("The request was aborted.", "AbortError");
    mockedRequest.mockRejectedValue(abort);
    await expect(
      bffActionRepository.execute({
        env,
        actor: { ...actor, raw: undefined },
        action: mustGet("driver.startTrip"),
        args: {},
        signal: new AbortController().signal,
      }),
    ).rejects.toBe(abort);
  });

  it("forwards the safe action reference without raw snapshots", async () => {
    mockedRequest.mockResolvedValue(envelope({}));
    await bffActionRepository.execute({
      env,
      actor: {
        ...actor,
        raw: { secret: true },
      },
      action: mustGet("driver.startTrip"),
      args: { id: "1" },
      signal: new AbortController().signal,
    });
    expect(mockedRequest).toHaveBeenCalledWith(
      "/api/wusool/actions/execute",
      {
        env: { envId: "local", baseUrl: undefined },
        actor: {
          id: "7",
          type: "driver",
          label: "Driver 7",
          authenticated: true,
          source: "existing",
        },
        actionId: "driver.startTrip",
        args: { id: "1" },
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
