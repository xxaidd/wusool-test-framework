import { beforeEach, describe, expect, it } from "vitest";
import {
  getDevCredentialVault,
  resetDevCredentialVault,
} from "@/infrastructure/server/credentialVaultDev";
import { POST } from "./route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/wusool/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/wusool/auth/logout", () => {
  beforeEach(() => {
    resetDevCredentialVault();
  });

  it("clears a single actor context", async () => {
    const vault = getDevCredentialVault();
    await vault.setContext("a1", "local", { accessToken: "t1" });
    await vault.setContext("a2", "local", { accessToken: "t2" });

    const res = await POST(req({ env: { envId: "local" }, actorId: "a1" }));
    expect(res.status).toBe(200);

    await expect(vault.resolve("a1", "local")).resolves.toBeNull();
    await expect(vault.resolve("a2", "local")).resolves.toEqual({
      accessToken: "t2",
    });
  });

  it("clears the whole environment when actorId is omitted", async () => {
    const vault = getDevCredentialVault();
    await vault.setContext("a1", "local", { accessToken: "t1" });
    await vault.setContext("a2", "local", { accessToken: "t2" });
    await vault.setContext("a1", "dev", { accessToken: "t3" });

    const res = await POST(req({ env: { envId: "local" } }));
    expect(res.status).toBe(200);

    await expect(vault.resolve("a1", "local")).resolves.toBeNull();
    await expect(vault.resolve("a2", "local")).resolves.toBeNull();
    await expect(vault.resolve("a1", "dev")).resolves.toEqual({
      accessToken: "t3",
    });
  });

  it("rejects malformed bodies", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(false);
  });

  it("never echoes tokens in the response", async () => {
    const vault = getDevCredentialVault();
    await vault.setContext("a1", "local", { accessToken: "super-secret-tok" });

    const res = await POST(req({ env: { envId: "local" }, actorId: "a1" }));
    const body = await res.text();
    expect(body).not.toContain("super-secret-tok");
    expect(body).not.toContain("accessToken");
  });
});
