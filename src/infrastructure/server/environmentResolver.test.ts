import { describe, expect, it } from "vitest";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { EnvironmentError, ValidationError } from "@/shared/errors";
import { resolveEnvironment } from "./environmentResolver";

describe("resolveEnvironment", () => {
  it("resolves a preset by id", async () => {
    const env = await resolveEnvironment({ envId: BackendEnvId.Local });
    expect(env.id).toBe(BackendEnvId.Local);
    expect(env.baseUrl).toBe("http://localhost:5002");
    expect(env.custom).toBeUndefined();
  });

  it("throws EnvironmentError for an unknown preset", async () => {
    await expect(resolveEnvironment({ envId: "nope" })).rejects.toThrow(
      EnvironmentError,
    );
  });

  it("accepts a public http custom URL", async () => {
    const env = await resolveEnvironment({
      envId: "custom",
      baseUrl: "http://93.184.216.34:8080",
    });
    expect(env.id).toBe(BackendEnvId.Custom);
    expect(env.custom).toBe(true);
    expect(env.baseUrl).toBe("http://93.184.216.34:8080");
  });

  it("rejects non-http schemes", async () => {
    await expect(
      resolveEnvironment({ envId: "custom", baseUrl: "ftp://x" }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects URLs embedding credentials", async () => {
    await expect(
      resolveEnvironment({
        envId: "custom",
        baseUrl: "http://user:pass@host",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects malformed URLs", async () => {
    await expect(
      resolveEnvironment({ envId: "custom", baseUrl: "not a url" }),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects private-network custom URLs (SSRF guard)", async () => {
    await expect(
      resolveEnvironment({
        envId: "custom",
        baseUrl: "http://10.0.0.5:8080",
      }),
    ).rejects.toThrow(EnvironmentError);
  });

  it("rejects loopback and link-local custom URLs (SSRF guard)", async () => {
    await expect(
      resolveEnvironment({
        envId: "custom",
        baseUrl: "http://127.0.0.1:5002",
      }),
    ).rejects.toThrow(EnvironmentError);
    await expect(
      resolveEnvironment({
        envId: "custom",
        baseUrl: "http://169.254.169.254",
      }),
    ).rejects.toThrow(EnvironmentError);
    await expect(
      resolveEnvironment({
        envId: "custom",
        baseUrl: "http://localhost:5002",
      }),
    ).rejects.toThrow(EnvironmentError);
  });

  it("allows private custom URLs when the policy opts in", async () => {
    const env = await resolveEnvironment(
      {
        envId: "custom",
        baseUrl: "http://10.0.0.5:8080",
      },
      { policy: { allowPrivateNetwork: true } },
    );
    expect(env.baseUrl).toBe("http://10.0.0.5:8080");
  });
});
