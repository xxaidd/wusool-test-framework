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
      adminConfigured: false,
      health: { ok: false, status: 0, checking: false },
    });
  });

  it("never persists the admin configuration flag", async () => {
    useEnvironmentStore.setState({ adminConfigured: true });
    const payload = persistedPayload();
    expect(payload).not.toContain("adminConfigured");
    expect(payload).not.toContain("adminToken");
    // The environment itself is still persisted.
    expect(payload).toContain("local");
  });

  it("tracks the admin configuration flag in memory", () => {
    useEnvironmentStore.getState().setAdminConfigured(true);
    expect(useEnvironmentStore.getState().adminConfigured).toBe(true);
    useEnvironmentStore.getState().setAdminConfigured(false);
    expect(useEnvironmentStore.getState().adminConfigured).toBe(false);
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
