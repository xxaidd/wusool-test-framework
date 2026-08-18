import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDevCredentialVault,
  resetDevCredentialVault,
} from "@/infrastructure/server/credentialVaultDev";
import { serverRequest } from "@/infrastructure/server/wusoolServerClient";
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
    type: "driver",
    label: "Driver 7",
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
      req({ ...base, actionId: "driver.startTrip", args: { id: "42" } }),
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
      req({ ...base, actionId: "driver.myShifts", args: {} }),
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
      "/api/v1/shifts/me",
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
});
