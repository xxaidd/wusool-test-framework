import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackendEnvironment } from "@/features/environments/domain/environment.types";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import {
  ApiError,
  apiRequestDetailed,
} from "@/infrastructure/http/WusoolApiClient";
import { httpActionRepository } from "./actionRepository";

vi.mock("@/infrastructure/http/WusoolApiClient", async (importActual) => {
  const actual =
    await importActual<
      typeof import("@/infrastructure/http/WusoolApiClient")
    >();
  return { ...actual, apiRequestDetailed: vi.fn() };
});

const env: BackendEnvironment = {
  id: BackendEnvId.Local,
  label: "Local",
  baseUrl: "http://localhost:5002",
};

const mockedRequest = vi.mocked(apiRequestDetailed);

describe("httpActionRepository", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("returns an ok result on success", async () => {
    mockedRequest.mockResolvedValue({ status: 201, data: { id: 1 } });
    const result = await httpActionRepository.execute({
      env,
      path: "/api/v1/thing",
      method: "GET",
    });
    expect(result).toEqual({ ok: true, status: 201, data: { id: 1 } });
  });

  it("normalizes ApiError failures", async () => {
    mockedRequest.mockRejectedValue(new ApiError(404, "not found"));
    const result = await httpActionRepository.execute({
      env,
      path: "/api/v1/thing",
      method: "GET",
    });
    expect(result).toEqual({ ok: false, status: 404, error: "not found" });
  });

  it("normalizes unknown failures to status 0", async () => {
    mockedRequest.mockRejectedValue(new Error("boom"));
    const result = await httpActionRepository.execute({
      env,
      path: "/api/v1/thing",
      method: "GET",
    });
    expect(result).toEqual({ ok: false, status: 0, error: "boom" });
  });

  it("forwards params, token and signal", async () => {
    const signal = new AbortController().signal;
    mockedRequest.mockResolvedValue({ status: 200, data: null });
    await httpActionRepository.execute({
      env,
      path: "/api/v1/thing",
      method: "POST",
      token: "abc",
      params: { a: "1" },
      data: { x: 1 },
      signal,
    });
    expect(mockedRequest).toHaveBeenCalledWith(
      env,
      "/api/v1/thing",
      expect.objectContaining({
        method: "POST",
        token: "abc",
        params: { a: "1" },
        data: { x: 1 },
        signal,
      }),
    );
  });
});
