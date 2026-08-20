import { afterEach, describe, expect, it, vi } from "vitest";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { createServerBackendLogRepository } from "./serverBackendLogRepository";

const env: BackendEnvironment = {
  id: BackendEnvId.Local,
  label: "Local",
  baseUrl: "http://localhost:5002",
};

const logEntry = {
  ts: "2026-08-19T12:00:00.000Z",
  level: "info",
  message: "Request handled",
};

describe("createServerBackendLogRepository", () => {
  afterEach(() => {
    delete process.env.WUSOOL_BACKEND_LOG_ENDPOINT;
  });

  it("returns unavailable when no endpoint is configured", async () => {
    delete process.env.WUSOOL_BACKEND_LOG_ENDPOINT;
    const repo = createServerBackendLogRepository(env);
    const result = await repo.fetchForCorrelation({
      envId: env.id,
      correlationId: "req_1",
    });
    expect(result).toEqual({ status: "unavailable" });
  });

  it("fetches, validates, and returns redacted entries when configured", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue([
        logEntry,
        { ts: "2026-08-19T12:00:01.000Z", level: "error", message: "boom" },
        { ts: "bad" },
      ]);
    const repo = createServerBackendLogRepository(env, {
      endpoint: "/logs",
      fetcher,
    });

    const result = await repo.fetchForCorrelation({
      envId: env.id,
      correlationId: "req_1",
      since: "2026-08-19T11:59:00.000Z",
      until: "2026-08-19T12:01:00.000Z",
      limit: 50,
    });

    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: env.baseUrl,
        endpoint: "/logs",
        correlationId: "req_1",
        since: "2026-08-19T11:59:00.000Z",
        until: "2026-08-19T12:01:00.000Z",
        limit: 50,
      }),
    );
    expect(result).toEqual({
      status: "success",
      entries: [
        logEntry,
        { ts: "2026-08-19T12:00:01.000Z", level: "error", message: "boom" },
      ],
    });
  });

  it("redacts sensitive values in log messages and metadata", async () => {
    const fetcher = vi.fn().mockResolvedValue([
      {
        ts: "2026-08-19T12:00:00.000Z",
        level: "info",
        message: JSON.stringify({
          user: "Passenger #1",
          accessToken: "secret-token",
        }),
        metadata: { actorId: "a1", authorization: "Bearer secret" },
      },
    ]);
    const repo = createServerBackendLogRepository(env, {
      endpoint: "/logs",
      fetcher,
    });

    const result = await repo.fetchForCorrelation({
      envId: env.id,
      correlationId: "req_1",
    });

    expect(result).toEqual({
      status: "success",
      entries: [
        {
          ts: "2026-08-19T12:00:00.000Z",
          level: "info",
          message: JSON.stringify(
            { user: "Passenger #1", accessToken: "••••••••" },
            null,
            2,
          ),
          metadata: { actorId: "a1", authorization: "••••••••" },
        },
      ],
    });
  });

  it("clamps the limit to the server-side cap", async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    const repo = createServerBackendLogRepository(env, {
      endpoint: "/logs",
      fetcher,
      maxLimit: 10,
    });

    await repo.fetchForCorrelation({
      envId: env.id,
      correlationId: "req_1",
      limit: 9999,
    });

    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 }),
    );
  });

  it("applies the default limit when none is provided", async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    const repo = createServerBackendLogRepository(env, {
      endpoint: "/logs",
      fetcher,
    });

    await repo.fetchForCorrelation({ envId: env.id, correlationId: "req_1" });

    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 200 }),
    );
  });

  it("returns an error result when the fetcher throws", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("connection refused"));
    const repo = createServerBackendLogRepository(env, {
      endpoint: "/logs",
      fetcher,
    });

    const result = await repo.fetchForCorrelation({
      envId: env.id,
      correlationId: "req_1",
    });

    expect(result).toEqual({ status: "error", message: "connection refused" });
  });

  it("propagates AbortError for cancellation", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    const fetcher = vi.fn().mockRejectedValue(abortError);
    const repo = createServerBackendLogRepository(env, {
      endpoint: "/logs",
      fetcher,
    });

    await expect(
      repo.fetchForCorrelation({ envId: env.id, correlationId: "req_1" }),
    ).rejects.toThrow("aborted");
  });

  it("returns an error for a non-array payload", async () => {
    const fetcher = vi.fn().mockResolvedValue({ not: "an array" });
    const repo = createServerBackendLogRepository(env, {
      endpoint: "/logs",
      fetcher,
    });

    const result = await repo.fetchForCorrelation({
      envId: env.id,
      correlationId: "req_1",
    });

    expect(result).toEqual({
      status: "error",
      message: "Unexpected backend log payload.",
    });
  });
});
