import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { AppError } from "@/shared/errors";
import { ActorSource, ActorType } from "../domain/actor.types";
import type { ActorRepository, SafeActor } from "./ActorRepository";
import { DiscoverActorsUseCase } from "./DiscoverActorsUseCase";

describe("DiscoverActorsUseCase", () => {
  const env: BackendEnvironment = {
    id: BackendEnvId.Local,
    label: "Local",
    baseUrl: "http://localhost:5002",
  };

  let mockDiscoverActors: ReturnType<typeof vi.fn<ActorRepository["discover"]>>;

  beforeEach(() => {
    mockDiscoverActors = vi.fn<ActorRepository["discover"]>();
  });

  it("discovers actors successfully", async () => {
    const mockActors: SafeActor[] = [
      {
        id: "11",
        type: ActorType.Bus,
        label: "ABC",
        authenticated: false,
        source: ActorSource.Existing,
      },
    ];

    mockDiscoverActors.mockResolvedValue({
      status: "success",
      actors: mockActors,
    });

    const result = await new DiscoverActorsUseCase(mockDiscoverActors).execute({
      envId: env.id,
      types: [ActorType.Passenger, ActorType.Driver, ActorType.Bus],
    });

    expect(mockDiscoverActors).toHaveBeenCalledWith({
      envId: env.id,
      types: [ActorType.Passenger, ActorType.Driver, ActorType.Bus],
      signal: undefined,
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.actors).toHaveLength(1);
    expect(result.actors[0]).toEqual(mockActors[0]);
  });

  it("handles discovery failure", async () => {
    const mockError = new AppError("BACKEND_UNAVAILABLE", "Network error", {
      status: 500,
    });

    mockDiscoverActors.mockResolvedValue({
      status: "failure",
      error: mockError,
    });

    const result = await new DiscoverActorsUseCase(mockDiscoverActors).execute({
      envId: env.id,
      types: [ActorType.Passenger],
    });

    expect(result.status).toBe("failure");
    if (result.status !== "failure") throw new Error("expected failure");
    expect(result.error).toEqual(mockError);
  });

  it("throws and catches unexpected errors", async () => {
    mockDiscoverActors.mockRejectedValue(new Error("Unexpected error"));

    const result = await new DiscoverActorsUseCase(mockDiscoverActors).execute({
      envId: env.id,
      types: [ActorType.Passenger],
    });

    expect(result.status).toBe("failure");
    if (result.status !== "failure") throw new Error("expected failure");
    expect(result.error.message).toBe("Unexpected error");
    expect(result.error.status).toBe(500);
  });
});
