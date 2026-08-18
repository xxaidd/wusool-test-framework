import { beforeEach, describe, expect, it } from "vitest";
import {
  DevCredentialVault,
  resetDevCredentialVault,
} from "./credentialVaultDev";

describe("DevCredentialVault", () => {
  beforeEach(() => {
    resetDevCredentialVault();
  });

  it("stores and resolves auth contexts per (actor, env)", async () => {
    const vault = new DevCredentialVault();
    await vault.setContext("a1", "local", { accessToken: "tok-a" });
    await vault.setContext("a1", "dev", { accessToken: "tok-dev" });
    await vault.setContext("a2", "local", { accessToken: "tok-b" });

    await expect(vault.resolve("a1", "local")).resolves.toEqual({
      accessToken: "tok-a",
    });
    await expect(vault.resolve("a1", "dev")).resolves.toEqual({
      accessToken: "tok-dev",
    });
    await expect(vault.resolve("a2", "local")).resolves.toEqual({
      accessToken: "tok-b",
    });
    await expect(vault.resolve("missing", "local")).resolves.toBeNull();
  });

  it("clears a single actor", async () => {
    const vault = new DevCredentialVault();
    await vault.setContext("a1", "local", { accessToken: "tok" });
    await vault.clear("a1", "local");
    await expect(vault.resolve("a1", "local")).resolves.toBeNull();
  });

  it("clears an entire environment", async () => {
    const vault = new DevCredentialVault();
    await vault.setContext("a1", "local", { accessToken: "t" });
    await vault.setContext("a2", "local", { accessToken: "t" });
    await vault.setContext("a1", "dev", { accessToken: "t" });
    await vault.clearForEnvironment("local");
    await expect(vault.resolve("a1", "local")).resolves.toBeNull();
    await expect(vault.resolve("a2", "local")).resolves.toBeNull();
    await expect(vault.resolve("a1", "dev")).resolves.toEqual({
      accessToken: "t",
    });
  });

  it("clears everything", async () => {
    const vault = new DevCredentialVault();
    await vault.setContext("a1", "local", { accessToken: "t" });
    await vault.clearAll();
    await expect(vault.resolve("a1", "local")).resolves.toBeNull();
  });

  it("stores and resolves admin contexts per environment", async () => {
    const vault = new DevCredentialVault();
    await vault.setAdminContext("local", {
      accessToken: "admin-tok",
      refreshToken: "admin-refresh",
    });
    await vault.setAdminContext("dev", { accessToken: "admin-tok-dev" });

    await expect(vault.resolveAdminContext("local")).resolves.toEqual({
      accessToken: "admin-tok",
      refreshToken: "admin-refresh",
    });
    await expect(vault.resolveAdminContext("dev")).resolves.toEqual({
      accessToken: "admin-tok-dev",
    });
    await expect(vault.resolveAdminContext("missing")).resolves.toBeNull();
  });

  it("clears a single admin context without touching actor contexts", async () => {
    const vault = new DevCredentialVault();
    await vault.setAdminContext("local", { accessToken: "admin" });
    await vault.setContext("a1", "local", { accessToken: "actor" });
    await vault.clearAdminContext("local");
    await expect(vault.resolveAdminContext("local")).resolves.toBeNull();
    await expect(vault.resolve("a1", "local")).resolves.toEqual({
      accessToken: "actor",
    });
  });

  it("clears admin contexts with their environment", async () => {
    const vault = new DevCredentialVault();
    await vault.setAdminContext("local", { accessToken: "admin" });
    await vault.setAdminContext("dev", { accessToken: "admin" });
    await vault.clearForEnvironment("local");
    await expect(vault.resolveAdminContext("local")).resolves.toBeNull();
    await expect(vault.resolveAdminContext("dev")).resolves.toEqual({
      accessToken: "admin",
    });
  });

  it("shares a singleton and resets it via resetDevCredentialVault", async () => {
    const first = (
      await import("./credentialVaultDev")
    ).getDevCredentialVault();
    const second = (
      await import("./credentialVaultDev")
    ).getDevCredentialVault();
    expect(first).toBe(second);
    resetDevCredentialVault();
    const third = (
      await import("./credentialVaultDev")
    ).getDevCredentialVault();
    expect(third).not.toBe(first);
  });
});
