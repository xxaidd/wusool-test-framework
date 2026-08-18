import { describe, expect, it } from "vitest";
import { BackendEnvId } from "@/features/environments/domain/environment.types";
import { EnvironmentError, ValidationError } from "@/shared/errors";
import { resolveEnvironment } from "./environmentResolver";

describe("resolveEnvironment", () => {
  it("resolves a preset by id", () => {
    const env = resolveEnvironment({ envId: BackendEnvId.Local });
    expect(env.id).toBe(BackendEnvId.Local);
    expect(env.baseUrl).toBe("http://localhost:5002");
    expect(env.custom).toBeUndefined();
  });

  it("throws EnvironmentError for an unknown preset", () => {
    expect(() => resolveEnvironment({ envId: "nope" })).toThrow(
      EnvironmentError,
    );
  });

  it("accepts a valid http custom URL", () => {
    const env = resolveEnvironment({
      envId: "custom",
      baseUrl: "http://10.0.0.5:8080",
    });
    expect(env.id).toBe(BackendEnvId.Custom);
    expect(env.custom).toBe(true);
    expect(env.baseUrl).toBe("http://10.0.0.5:8080");
  });

  it("rejects non-http schemes", () => {
    expect(() =>
      resolveEnvironment({ envId: "custom", baseUrl: "ftp://x" }),
    ).toThrow(ValidationError);
  });

  it("rejects URLs embedding credentials", () => {
    expect(() =>
      resolveEnvironment({
        envId: "custom",
        baseUrl: "http://user:pass@host",
      }),
    ).toThrow(ValidationError);
  });

  it("rejects malformed URLs", () => {
    expect(() =>
      resolveEnvironment({ envId: "custom", baseUrl: "not a url" }),
    ).toThrow(ValidationError);
  });
});
