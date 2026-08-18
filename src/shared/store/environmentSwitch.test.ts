import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActorSource, ActorType } from "@/features/actors/domain/actor.types";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { SessionSource } from "@/features/sessions/domain/session.types";
import { BffError, bffRequest } from "@/infrastructure/bff/client";
import { useActorStore } from "@/shared/store/actor.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { useEnvironmentStore } from "@/shared/store/environment.store";
import { switchEnvironment } from "@/shared/store/environmentSwitch";
import { useSessionStore } from "@/shared/store/session.store";

vi.mock("@/infrastructure/bff/client", async (importActual) => {
  const actual =
    await importActual<typeof import("@/infrastructure/bff/client")>();
  return {
    ...actual,
    bffRequest: vi.fn(),
  };
});

const mockedBffRequest = vi.mocked(bffRequest);

const localEnv: BackendEnvironment = {
  id: BackendEnvId.Local,
  label: "Local",
  baseUrl: "http://localhost:5002",
};
const stagingEnv: BackendEnvironment = {
  id: BackendEnvId.Staging,
  label: "Staging",
  baseUrl: "http://localhost:5002",
};

function seedWorkspace() {
  useActorStore.getState().addToWorkspace({
    id: "7",
    type: ActorType.Passenger,
    label: "Passenger 7",
    sublabel: "p7@example.com",
    authenticated: true,
    source: ActorSource.Existing,
  });
  useActorStore.getState().selectActor("7");
  useAuthStore.getState().setAuthenticated("7", "p7@example.com");
  useSessionStore.getState().setEnvId(BackendEnvId.Local);
  useSessionStore.getState().start();
  useSessionStore.getState().addEvent({
    source: SessionSource.Manual,
    actorId: "7",
    actorLabel: "Passenger 7",
    actionId: "passenger.myBookings",
    actionLabel: "My bookings",
    categoryId: "booking",
    summary: "Listed my bookings",
    status: "success",
  });
}

describe("switchEnvironment", () => {
  beforeEach(() => {
    useEnvironmentStore.setState({
      env: localEnv,
      adminToken: "",
      health: { ok: true, status: 200, checking: false },
    });
    useActorStore.setState({
      workspace: [],
      discovered: [],
      selectedActorId: null,
      search: "",
      typeFilter: "all",
      placed: [],
      drawingRoute: false,
    });
    useAuthStore.setState({ authenticated: {}, emails: {} });
    useSessionStore.setState({
      recording: false,
      paused: false,
      startedAt: undefined,
      envId: undefined,
      events: [],
    });
    mockedBffRequest.mockReset();
  });

  it("validates the target before committing (invalid URL aborts unchanged)", async () => {
    mockedBffRequest.mockRejectedValueOnce(
      new BffError(400, "Invalid backend URL.", "ENVIRONMENT"),
    );

    const result = await switchEnvironment(stagingEnv, "");

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Invalid backend URL");
    expect(useEnvironmentStore.getState().env.id).toBe(BackendEnvId.Local);
    expect(useEnvironmentStore.getState().env.baseUrl).toBe(
      "http://localhost:5002",
    );
  });

  it("switches atomically and clears all environment-scoped state", async () => {
    seedWorkspace();
    mockedBffRequest.mockImplementation(async (path: string) => {
      if (path === "/api/wusool/health") return { ok: true, status: 200 };
      if (path === "/api/wusool/auth/logout") return { cleared: true };
      throw new Error(`Unexpected path ${path}`);
    });

    const result = await switchEnvironment(stagingEnv, "admin-jwt");

    expect(result.ok).toBe(true);
    // Environment committed.
    expect(useEnvironmentStore.getState().env.id).toBe(BackendEnvId.Staging);
    expect(useEnvironmentStore.getState().adminToken).toBe("admin-jwt");
    // Old environment vault contexts cleared.
    expect(mockedBffRequest).toHaveBeenCalledWith(
      "/api/wusool/auth/logout",
      expect.objectContaining({ env: { envId: "local" } }),
    );
    // Actor + auth state cleared.
    expect(useActorStore.getState().workspace).toEqual([]);
    expect(useActorStore.getState().selectedActorId).toBeNull();
    expect(useAuthStore.getState().authenticated).toEqual({});
    // Session finalized: one environment.switched boundary event only.
    const session = useSessionStore.getState();
    expect(session.envId).toBe(BackendEnvId.Staging);
    expect(session.events).toHaveLength(1);
    expect(session.events[0]).toMatchObject({
      source: "system",
      actionId: "environment.switch",
      status: "info",
      summary: "Local → Staging",
    });
  });

  it("keeps the environment when the backend is unreachable but valid", async () => {
    mockedBffRequest.mockImplementation(async (path: string) => {
      if (path === "/api/wusool/health")
        throw new BffError(502, "Backend unavailable", "BACKEND_UNAVAILABLE");
      if (path === "/api/wusool/auth/logout") return { cleared: true };
      throw new Error(`Unexpected path ${path}`);
    });

    const result = await switchEnvironment(stagingEnv, "");

    expect(result.ok).toBe(true);
    expect(useEnvironmentStore.getState().env.id).toBe(BackendEnvId.Staging);
  });

  it("is a no-op for the same environment except the admin token", async () => {
    mockedBffRequest.mockRejectedValue(
      new Error("should not be called for unchanged env"),
    );

    const result = await switchEnvironment(localEnv, "admin-jwt");

    expect(result.ok).toBe(true);
    expect(mockedBffRequest).not.toHaveBeenCalled();
    expect(useEnvironmentStore.getState().adminToken).toBe("admin-jwt");
    expect(useEnvironmentStore.getState().env.id).toBe(BackendEnvId.Local);
  });
});
