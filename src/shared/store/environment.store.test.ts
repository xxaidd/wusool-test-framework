import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { bffRequest } from "@/infrastructure/bff/client";
import { useEnvironmentStore } from "./environment.store";

vi.mock("@/infrastructure/bff/client", async (importActual) => {
  const actual =
    await importActual<typeof import("@/infrastructure/bff/client")>();
  return { ...actual, bffRequest: vi.fn() };
});

const mockedBffRequest = vi.mocked(bffRequest);

function persistedPayload(): string {
  return globalThis.sessionStorage.getItem("wusool-environment") ?? "";
}

describe("useEnvironmentStore", () => {
  beforeEach(() => {
    mockedBffRequest.mockReset();
    useEnvironmentStore.setState({
      env: {
        id: BackendEnvId.Local,
        label: "Local",
        baseUrl: "http://localhost:5002",
      },
      adminToken: "",
      health: { ok: false, status: 0, checking: false },
    });
  });

  it("never persists the admin token", async () => {
    useEnvironmentStore.setState({ adminToken: "admin-jwt" });
    const payload = persistedPayload();
    expect(payload).not.toContain("adminToken");
    expect(payload).not.toContain("admin-jwt");
    // The environment itself is still persisted.
    expect(payload).toContain("local");
  });

  it("setEnv resets health and probes the new environment", async () => {
    mockedBffRequest.mockResolvedValue({ ok: true, status: 200 });

    useEnvironmentStore.getState().setEnv({
      id: BackendEnvId.Staging,
      label: "Staging",
      baseUrl: "http://localhost:5002",
    });

    expect(useEnvironmentStore.getState().env.id).toBe(BackendEnvId.Staging);
    await vi.waitFor(() => {
      expect(useEnvironmentStore.getState().health).toEqual({
        ok: true,
        status: 200,
        checking: false,
      });
    });
    expect(mockedBffRequest).toHaveBeenCalledWith(
      "/api/wusool/health",
      expect.objectContaining({
        env: expect.objectContaining({ envId: "staging" }),
      }),
    );
  });

  it("marks health unavailable when the probe fails", async () => {
    mockedBffRequest.mockRejectedValue(new Error("network down"));

    await useEnvironmentStore.getState().checkHealth();

    expect(useEnvironmentStore.getState().health).toEqual({
      ok: false,
      status: 0,
      checking: false,
    });
  });
});
