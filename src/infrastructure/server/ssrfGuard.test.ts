import { describe, expect, it } from "vitest";
import { EnvironmentError, ValidationError } from "@/shared/errors";
import {
  assertSafeCustomUrl,
  isBlockedHost,
  isBlockedIPv4,
  isBlockedIPv6,
} from "./ssrfGuard";

const resolveTo =
  (addresses: string[]) => async (): Promise<Array<{ address: string }>> =>
    addresses.map((address) => ({ address }));

describe("isBlockedIPv4", () => {
  it("blocks loopback, private, link-local, metadata, and reserved blocks", () => {
    for (const addr of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "169.254.10.5",
      "100.64.0.1",
      "198.18.0.1",
      "192.0.2.1",
      "224.0.0.1",
      "240.0.0.1",
      "0.0.0.0",
      "255.255.255.255",
    ]) {
      expect(isBlockedIPv4(addr), addr).toBe(true);
    }
  });

  it("allows globally routable addresses", () => {
    for (const addr of ["8.8.8.8", "1.1.1.1", "93.184.216.34"]) {
      expect(isBlockedIPv4(addr), addr).toBe(false);
    }
  });
});

describe("isBlockedIPv6", () => {
  it("blocks loopback, ULA, link-local, multicast, and unspecified", () => {
    for (const addr of [
      "::1",
      "::",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "ff02::1",
      "2001:db8::1",
    ]) {
      expect(isBlockedIPv6(addr), addr).toBe(true);
    }
  });

  it("blocks IPv4-mapped IPv6 when the embedded IPv4 is private", () => {
    expect(isBlockedIPv6("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedIPv6("::ffff:10.0.0.1")).toBe(true);
  });

  it("allows IPv4-mapped IPv6 with a public embedded address", () => {
    expect(isBlockedIPv6("::ffff:8.8.8.8")).toBe(false);
  });
});

describe("isBlockedHost", () => {
  it("blocks localhost names", async () => {
    await expect(isBlockedHost("localhost")).resolves.toBe(true);
    await expect(isBlockedHost("foo.localhost")).resolves.toBe(true);
  });

  it("resolves DNS names and blocks private addresses (rebinding defense)", async () => {
    await expect(
      isBlockedHost("internal.example.com", resolveTo(["10.0.0.7"])),
    ).resolves.toBe(true);
    await expect(
      isBlockedHost("api.example.com", resolveTo(["93.184.216.34"])),
    ).resolves.toBe(false);
    await expect(
      isBlockedHost(
        "mix.example.com",
        resolveTo(["93.184.216.34", "10.0.0.7"]),
      ),
    ).resolves.toBe(true);
  });

  it("fails closed on unresolvable hostnames", async () => {
    await expect(
      isBlockedHost("nx.example.com", async () => {
        throw new Error("ENOTFOUND");
      }),
    ).resolves.toBe(true);
  });
});

describe("assertSafeCustomUrl", () => {
  it("rejects private-network URLs by default", async () => {
    await expect(assertSafeCustomUrl("http://10.0.0.5:8080")).rejects.toThrow(
      EnvironmentError,
    );
    await expect(assertSafeCustomUrl("http://127.0.0.1:5002")).rejects.toThrow(
      EnvironmentError,
    );
    await expect(assertSafeCustomUrl("http://[::1]:5002")).rejects.toThrow(
      EnvironmentError,
    );
  });

  it("resolves hostnames and rejects private targets", async () => {
    await expect(
      assertSafeCustomUrl("http://internal.example.com", {
        resolve: resolveTo(["192.168.1.5"]),
      }),
    ).rejects.toThrow(EnvironmentError);
    await expect(
      assertSafeCustomUrl("http://api.example.com", {
        resolve: resolveTo(["93.184.216.34"]),
      }),
    ).resolves.toBeUndefined();
  });

  it("accepts public URLs without DNS", async () => {
    await expect(
      assertSafeCustomUrl("https://8.8.8.8"),
    ).resolves.toBeUndefined();
    await expect(
      assertSafeCustomUrl("http://93.184.216.34:8080"),
    ).resolves.toBeUndefined();
  });

  it("rejects non-http schemes, embedded credentials, and malformed URLs", async () => {
    await expect(assertSafeCustomUrl("ftp://api.example.com")).rejects.toThrow(
      ValidationError,
    );
    await expect(
      assertSafeCustomUrl("http://user:pass@api.example.com"),
    ).rejects.toThrow(ValidationError);
    await expect(assertSafeCustomUrl("not a url")).rejects.toThrow(
      ValidationError,
    );
  });

  it("bypasses the guard when the policy allows private networks", async () => {
    await expect(
      assertSafeCustomUrl("http://10.0.0.5:8080", {
        policy: { allowPrivateNetwork: true },
      }),
    ).resolves.toBeUndefined();
  });
});
