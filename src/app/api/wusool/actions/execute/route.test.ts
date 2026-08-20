import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDevCredentialVault,
  resetDevCredentialVault,
} from "@/infrastructure/server/credentialVaultDev";
import {
  ServerApiError,
  serverRequest,
} from "@/infrastructure/server/wusoolServerClient";
import { POST } from "./route";

vi.mock("@/infrastructure/server/wusoolServerClient", async (importActual) => {
  const actual =
    await importActual<
      typeof import("@/infrastructure/server/wusoolServerClient")
    >();
  return { ...actual, serverRequest: vi.fn() };
});

const mockedServerRequest = vi.mocked(serverRequest);

function req(body: unknown): Request {
  return new Request("http://localhost/api/wusool/actions/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const base = {
  env: { envId: "local" },
  actor: {
    id: "7",
    type: "passenger",
    label: "Passenger 7",
    authenticated: true,
    source: "existing",
  },
};

describe("POST /api/wusool/actions/execute", () => {
  beforeEach(() => {
    resetDevCredentialVault();
    mockedServerRequest.mockReset();
  });

  it("returns needs-auth when the action requires auth and the vault has no token", async () => {
    const res = await POST(
      req({ ...base, actionId: "passenger.myBookings", args: {} }),
    );
    const json = (await res.json()) as {
      ok: boolean;
      data: { needsAuth: boolean; statusCode: number; ok: boolean };
    };

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.needsAuth).toBe(true);
    expect(json.data.ok).toBe(false);
    expect(json.data.statusCode).toBe(401);
    expect(mockedServerRequest).not.toHaveBeenCalled();
  });

  it("returns needs-auth for an expired vault context without calling the backend", async () => {
    await getDevCredentialVault().setContext("7", "local", {
      accessToken: "stale-token",
      expiresAt: Date.now() - 60_000,
    });

    const res = await POST(
      req({ ...base, actionId: "passenger.myBookings", args: {} }),
    );
    const json = (await res.json()) as {
      ok: boolean;
      data: { needsAuth: boolean; ok: boolean };
    };

    expect(json.ok).toBe(true);
    expect(json.data.needsAuth).toBe(true);
    expect(json.data.ok).toBe(false);
    expect(mockedServerRequest).not.toHaveBeenCalled();
  });

  it("executes with a vault context that has not expired yet", async () => {
    await getDevCredentialVault().setContext("7", "local", {
      accessToken: "tok-fresh",
      expiresAt: Date.now() + 60_000,
    });
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: { items: [] },
      headers: {},
    });

    const res = await POST(
      req({ ...base, actionId: "passenger.myBookings", args: {} }),
    );
    const json = (await res.json()) as { data: { ok: boolean } };

    expect(json.data.ok).toBe(true);
    expect(mockedServerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:5002" }),
      "/api/v1/user-trips/me",
      expect.objectContaining({ token: "tok-fresh" }),
    );
  });

  it("executes an authenticated action with the vault token", async () => {
    await getDevCredentialVault().setContext("7", "local", {
      accessToken: "tok",
    });
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: { items: [] },
      headers: { "x-trace-id": "trace-1" },
    });

    const res = await POST(
      req({ ...base, actionId: "passenger.myBookings", args: {} }),
    );
    const json = (await res.json()) as {
      data: {
        ok: boolean;
        correlation?: { traceId?: string };
        request?: object;
        response?: object;
      };
    };

    expect(json.data.ok).toBe(true);
    expect(mockedServerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:5002" }),
      "/api/v1/user-trips/me",
      expect.objectContaining({ method: "GET", token: "tok" }),
    );
    expect(json.data.correlation?.traceId).toBe("trace-1");
    expect(json.data.request).toBeDefined();
    expect(json.data.response).toBeDefined();
  });

  it("executes non-auth actions without a vault token", async () => {
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: { items: [] },
      headers: {},
    });

    const res = await POST(
      req({ ...base, actionId: "general.listStops", args: {} }),
    );
    const json = (await res.json()) as { data: { ok: boolean } };

    expect(json.data.ok).toBe(true);
    expect(mockedServerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:5002" }),
      "/api/v1/stops",
      expect.objectContaining({ token: undefined }),
    );
  });

  it("rejects unknown action ids", async () => {
    const res = await POST(req({ ...base, actionId: "nope", args: {} }));
    const json = (await res.json()) as {
      ok: boolean;
      error: { code: string };
    };

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("VALIDATION");
    expect(mockedServerRequest).not.toHaveBeenCalled();
  });

  it("rejects malformed bodies", async () => {
    const res = await POST(req({ env: {} }));
    const json = (await res.json()) as { ok: boolean };

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
  });

  it("returns a unique execution id and a human summary even for needs-auth", async () => {
    const res = await POST(
      req({ ...base, actionId: "passenger.myBookings", args: {} }),
    );
    const json = (await res.json()) as {
      data: { executionId: string; summary: { key: string } };
    };
    expect(json.data.executionId).toMatch(/^exec_/);
    expect(json.data.summary.key).toBe("action.authRequired");
  });

  it("rejects invalid inputs in normal mode without calling the backend", async () => {
    const res = await POST(
      req({ ...base, actionId: "passenger.reserve", args: { busTripId: "1" } }),
    );
    const json = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("VALIDATION");
    expect(mockedServerRequest).not.toHaveBeenCalled();
  });

  it("advanced invalid-test mode bypasses normal validation", async () => {
    await getDevCredentialVault().setContext("7", "local", {
      accessToken: "tok",
    });
    mockedServerRequest.mockRejectedValue(
      new ServerApiError(400, "reserve failed", "BUSINESS", { error: "bad" }),
    );

    const res = await POST(
      req({
        ...base,
        actionId: "passenger.reserve",
        args: { busTripId: "1" },
        mode: "invalid",
      }),
    );
    const json = (await res.json()) as { data: { ok: boolean } };

    expect(json.data.ok).toBe(false);
    expect(mockedServerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:5002" }),
      "/api/v1/user-trips/reserve",
      expect.objectContaining({ method: "POST", token: "tok" }),
    );
  });

  it("never sends a path selector in the body when the contract keeps it in path", async () => {
    await getDevCredentialVault().setContext("7", "local", {
      accessToken: "tok",
    });
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: { id: 9 },
      headers: {},
    });

    await POST(
      req({
        ...base,
        actionId: "passenger.cancelBooking",
        args: { id: "9", reason: "plans" },
      }),
    );

    expect(mockedServerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:5002" }),
      "/api/v1/user-trips/9/cancel",
      expect.objectContaining({ data: { reason: "plans" } }),
    );
  });
});

describe("POST /api/wusool/actions/execute — result presentation", () => {
  beforeEach(() => {
    resetDevCredentialVault();
    mockedServerRequest.mockReset();
  });

  it("surfaces the human-readable success summary and sanitized evidence", async () => {
    await getDevCredentialVault().setContext("7", "local", {
      accessToken: "tok",
    });
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: { id: 184 },
      headers: {},
    });
    const res = await POST(
      req({
        ...base,
        actionId: "passenger.reserve",
        args: { busTripId: "184", boardingStopId: "20", alightingStopId: "30" },
      }),
    );
    const json = (await res.json()) as {
      data: {
        ok: boolean;
        summary: { key: string; params: Record<string, string> };
        request: { path: string };
        response: { statusCode: number };
      };
    };
    expect(json.data.ok).toBe(true);
    expect(json.data.summary.key).toBe("result.passenger.reserved");
    expect(json.data.summary.params.trip).toBe("184");
    expect(json.data.request.path).toBe("/api/v1/user-trips/reserve");
    expect(json.data.response.statusCode).toBe(200);
  });
});
