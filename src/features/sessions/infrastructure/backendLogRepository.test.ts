import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { BffError, bffRequest } from "@/infrastructure/bff/client";
import { createBackendLogRepository } from "./backendLogRepository";

vi.mock("@/infrastructure/bff/client", async (importActual) => {
  const actual =
    await importActual<typeof import("@/infrastructure/bff/client")>();
  return { ...actual, bffRequest: vi.fn() };
});

const mockedBffRequest = vi.mocked(bffRequest);

const env = {
  id: BackendEnvId.Local,
  label: "Local",
  baseUrl: "http://localhost:5002",
};

const entry = { ts: "2026-08-19T12:00:00.000Z", level: "info", message: "ok" };

describe("createBackendLogRepository", () => {
  beforeEach(() => {
    mockedBffRequest.mockReset();
  });

  it("returns entries on success", async () => {
    mockedBffRequest.mockResolvedValue({ entries: [entry] });
    const repo = createBackendLogRepository(env);

    const result = await repo.fetchForCorrelation({
      envId: env.id,
      correlationId: "req_1",
      since: "2026-08-19T11:59:00.000Z",
      until: "2026-08-19T12:01:00.000Z",
      limit: 50,
    });

    expect(result).toEqual({ status: "success", entries: [entry] });
    expect(mockedBffRequest).toHaveBeenCalledWith(
      "/api/wusool/logs",
      {
        env: { envId: env.id },
        correlationId: "req_1",
        since: "2026-08-19T11:59:00.000Z",
        until: "2026-08-19T12:01:00.000Z",
        limit: 50,
      },
      expect.anything(),
    );
  });

  it("sends the custom baseUrl for custom environments", async () => {
    mockedBffRequest.mockResolvedValue({ entries: [] });
    const repo = createBackendLogRepository({
      id: BackendEnvId.Custom,
      label: "Custom",
      baseUrl: "https://custom.example",
      custom: true,
    });

    await repo.fetchForCorrelation({
      envId: BackendEnvId.Custom,
      correlationId: "req_1",
    });

    expect(mockedBffRequest).toHaveBeenCalledWith(
      "/api/wusool/logs",
      expect.objectContaining({
        env: { envId: BackendEnvId.Custom, baseUrl: "https://custom.example" },
      }),
      expect.anything(),
    );
  });

  it("maps LOG_API_UNAVAILABLE to the unavailable state", async () => {
    mockedBffRequest.mockRejectedValue(
      new BffError(
        501,
        "Backend log API is not configured.",
        "LOG_API_UNAVAILABLE",
      ),
    );
    const repo = createBackendLogRepository(env);

    const result = await repo.fetchForCorrelation({
      envId: env.id,
      correlationId: "req_1",
    });
    expect(result).toEqual({ status: "unavailable" });
  });

  it("maps 401/403 to the permission state", async () => {
    mockedBffRequest.mockRejectedValue(
      new BffError(403, "Forbidden.", "LOG_API_PERMISSION"),
    );
    const repo = createBackendLogRepository(env);

    const result = await repo.fetchForCorrelation({
      envId: env.id,
      correlationId: "req_1",
    });
    expect(result).toEqual({ status: "permission" });
  });

  it("maps other failures to the error state with a message", async () => {
    mockedBffRequest.mockRejectedValue(new BffError(502, "connection refused"));
    const repo = createBackendLogRepository(env);

    const result = await repo.fetchForCorrelation({
      envId: env.id,
      correlationId: "req_1",
    });
    expect(result).toEqual({ status: "error", message: "connection refused" });
  });

  it("propagates AbortError for cancellation", async () => {
    const abort = new DOMException("aborted", "AbortError");
    mockedBffRequest.mockRejectedValue(abort);
    const repo = createBackendLogRepository(env);

    await expect(
      repo.fetchForCorrelation({ envId: env.id, correlationId: "req_1" }),
    ).rejects.toThrow("aborted");
  });
});
