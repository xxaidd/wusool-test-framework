import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverProbe } from "@/infrastructure/server/wusoolServerClient";
import { POST } from "./route";

vi.mock("@/infrastructure/server/wusoolServerClient", async (importActual) => {
  const actual =
    await importActual<
      typeof import("@/infrastructure/server/wusoolServerClient")
    >();
  return { ...actual, serverProbe: vi.fn() };
});

const mockedServerProbe = vi.mocked(serverProbe);

function req(body: unknown): Request {
  return new Request("http://localhost/api/wusool/health", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/wusool/health", () => {
  beforeEach(() => {
    mockedServerProbe.mockReset();
  });

  it("probes a preset environment server-side", async () => {
    mockedServerProbe.mockResolvedValue({ ok: true, status: 200 });

    const res = await POST(req({ env: { envId: "local" } }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      data: { ok: boolean; status: number };
    };
    expect(json.data).toEqual({ ok: true, status: 200 });
    expect(mockedServerProbe).toHaveBeenCalledWith("http://localhost:5002");
  });

  it("rejects a private-network custom URL without probing", async () => {
    const res = await POST(
      req({ env: { envId: "custom", baseUrl: "http://10.0.0.5:8080" } }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      ok: boolean;
      error: { code?: string; message?: string };
    };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("ENVIRONMENT");
    expect(mockedServerProbe).not.toHaveBeenCalled();
  });

  it("rejects a non-http custom URL", async () => {
    const res = await POST(
      req({ env: { envId: "custom", baseUrl: "ftp://api.example.com" } }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      ok: boolean;
      error: { code?: string; message?: string };
    };
    expect(json.error.code).toBe("VALIDATION");
    expect(mockedServerProbe).not.toHaveBeenCalled();
  });
});
