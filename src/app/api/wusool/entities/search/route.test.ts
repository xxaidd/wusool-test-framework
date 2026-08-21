import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDevCredentialVault,
  resetDevCredentialVault,
} from "@/infrastructure/server/credentialVaultDev";
import {
  serverRefresh,
  serverRequest,
} from "@/infrastructure/server/wusoolServerClient";
import { POST } from "./route";

vi.mock("@/infrastructure/server/wusoolServerClient", async (importActual) => {
  const actual =
    await importActual<
      typeof import("@/infrastructure/server/wusoolServerClient")
    >();
  return { ...actual, serverRefresh: vi.fn(), serverRequest: vi.fn() };
});

const mockedServerRequest = vi.mocked(serverRequest);
const mockedServerRefresh = vi.mocked(serverRefresh);

function req(body: unknown): Request {
  return new Request("http://localhost/api/wusool/entities/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const now = Date.now();

describe("POST /api/wusool/entities/search", () => {
  beforeEach(() => {
    resetDevCredentialVault();
    mockedServerRequest.mockReset();
    mockedServerRefresh.mockReset();
  });

  it("returns stops whose stopType is a localized string, not a StopType enum value", async () => {
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: {
        items: [
          { id: 303, name: "King Saud Rd", stopType: "موقف حافلات" },
          { id: 304, name: "Central Terminal", stopType: "محطة" },
        ],
      },
      headers: {},
    });

    const res = await POST(req({ env: { envId: "local" }, kind: "stop" }));
    const body = (await res.json()) as {
      ok: boolean;
      data: { value: string; label: string }[];
    };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.map((o) => ({ value: o.value, label: o.label }))).toEqual([
      { value: "303", label: "King Saud Rd" },
      { value: "304", label: "Central Terminal" },
    ]);
    expect(mockedServerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:5002" }),
      "/api/v1/stops",
      expect.objectContaining({
        params: expect.objectContaining({ pageSize: 25 }),
      }),
    );
  });

  it("uses the actor vault token when an actorId is provided", async () => {
    await getDevCredentialVault().setContext("7", "local", {
      accessToken: "actor-tok",
      expiresAt: now + 60_000,
    });
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: {
        items: [{ id: 101, name: "Central Station", stopType: "Terminal" }],
      },
      headers: {},
    });

    const res = await POST(
      req({ env: { envId: "local" }, actorId: "7", kind: "stop" }),
    );
    const body = (await res.json()) as {
      ok: boolean;
      data: { value: string; label: string }[];
    };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.map((o) => ({ value: o.value, label: o.label }))).toEqual([
      { value: "101", label: "Central Station" },
    ]);
    expect(mockedServerRequest).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:5002" }),
      "/api/v1/stops",
      expect.objectContaining({ token: "actor-tok" }),
    );
    expect(mockedServerRefresh).not.toHaveBeenCalled();
  });

  it("skips malformed items without crashing the search", async () => {
    mockedServerRequest.mockResolvedValue({
      status: 200,
      data: {
        items: [
          { id: 101, name: "Good Stop", stopType: "BusStop" },
          { name: "No Id" },
          { id: 102, name: "Also Good", stopType: null },
        ],
      },
      headers: {},
    });

    const res = await POST(req({ env: { envId: "local" }, kind: "stop" }));
    const body = (await res.json()) as {
      ok: boolean;
      data: { value: string; label: string }[];
    };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.map((o) => ({ value: o.value, label: o.label }))).toEqual([
      { value: "101", label: "Good Stop" },
      { value: "102", label: "Also Good" },
    ]);
  });
});
