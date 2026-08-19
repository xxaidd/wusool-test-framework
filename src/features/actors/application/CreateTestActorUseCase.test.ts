import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { AppError } from "@/shared/errors";
import { ActorSource, ActorType } from "../domain/actor.types";
import type { ActorRepository, SafeActor } from "./ActorRepository";
import { CreateTestActorUseCase } from "./CreateTestActorUseCase";

describe("CreateTestActorUseCase", () => {
  const env: BackendEnvironment = {
    id: BackendEnvId.Local,
    label: "Local",
    baseUrl: "http://localhost:5002",
  };

  let mockCreateActor: ReturnType<typeof vi.fn<ActorRepository["create"]>>;

  beforeEach(() => {
    mockCreateActor = vi.fn<ActorRepository["create"]>();
  });

  it("creates a passenger actor successfully", async () => {
    const mockActor: SafeActor = {
      id: "u1",
      type: ActorType.Passenger,
      label: "Passenger",
      sublabel: "p@x",
      authenticated: true,
      source: ActorSource.Test,
      email: "p@x",
    };

    mockCreateActor.mockResolvedValue({
      status: "success",
      actor: mockActor,
    });

    const result = await new CreateTestActorUseCase(mockCreateActor).execute({
      envId: env.id,
      type: ActorType.Passenger,
      email: "p@x",
      password: "pass123",
      name: "Passenger",
    });

    expect(mockCreateActor).toHaveBeenCalledWith({
      envId: env.id,
      type: ActorType.Passenger,
      email: "p@x",
      password: "pass123",
      name: "Passenger",
      plateNumber: undefined,
      capacityNumber: undefined,
      signal: undefined,
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.actor).toEqual(mockActor);
  });

  it("handles creation failure", async () => {
    const mockError = new AppError("BUSINESS", "Creation failed", {
      status: 400,
    });

    mockCreateActor.mockResolvedValue({
      status: "failure",
      error: mockError,
    });

    const result = await new CreateTestActorUseCase(mockCreateActor).execute({
      envId: env.id,
      type: ActorType.Passenger,
    });

    expect(result.status).toBe("failure");
    if (result.status !== "failure") throw new Error("expected failure");
    expect(result.error).toEqual(mockError);
  });

  it("throws and catches unexpected errors", async () => {
    mockCreateActor.mockRejectedValue(new Error("Unexpected error"));

    const result = await new CreateTestActorUseCase(mockCreateActor).execute({
      envId: env.id,
      type: ActorType.Passenger,
    });

    expect(result.status).toBe("failure");
    if (result.status !== "failure") throw new Error("expected failure");
    expect(result.error.message).toBe("Unexpected error");
    expect(result.error.status).toBe(500);
  });
});
