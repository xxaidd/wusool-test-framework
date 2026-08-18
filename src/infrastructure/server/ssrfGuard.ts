import { lookup as dnsLookup } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";
import type { SsrfPolicy } from "@/infrastructure/configuration/ssrfPolicy";
import { EnvironmentError, ValidationError } from "@/shared/errors";

/** Resolves a DNS hostname to its addresses; injected for deterministic tests. */
export type HostResolver = (
  hostname: string,
) => Promise<Array<{ address: string }>>;

const defaultHostResolver: HostResolver = (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true }).then(
    (records) => records as Array<{ address: string }>,
  );

/** Normalize an IPv6 address and strip a zone id if present. */
function normalizeV6(address: string): string {
  return address.split("%")[0].toLowerCase();
}

function isV4MappedV6(address: string): string | null {
  const m = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  return m ? m[1] : null;
}

/** True when an IPv4 address lives in a non-globally-routable block. */
export function isBlockedIPv4(address: string): boolean {
  if (!isIPv4(address)) return true;
  const octets = address.split(".").map(Number);
  const [a, b, c] = octets;
  if (a === 0 || a === 10) return true; // unspecified / private-10
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private-172
  if (a === 192 && b === 168) return true; // private-192
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

/** True when an IPv6 address is loopback/ULA/link-local/multicast/unspecified. */
export function isBlockedIPv6(address: string): boolean {
  const v4 = isV4MappedV6(address);
  if (v4) return isBlockedIPv4(v4);

  const addr = normalizeV6(address);
  if (addr === "::" || addr === "::1") return true; // unspecified / loopback
  if (addr.startsWith("fe80")) return true; // link-local
  if (/^fc/.test(addr) || /^fd/.test(addr)) return true; // ULA fc00::/7
  if (addr.startsWith("ff")) return true; // multicast
  if (addr.startsWith("2001:db8")) return true; // documentation
  if (addr.startsWith("2001:10")) return true; // ORCHID
  if (addr.startsWith("64:ff9b")) return true; // NAT64 well-known prefix
  return false;
}

/** Classify a host literal or DNS name; resolves names to catch rebinding. */
export async function isBlockedHost(
  hostname: string,
  resolve: HostResolver = defaultHostResolver,
): Promise<boolean> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (isIPv4(host)) return isBlockedIPv4(host);
  if (isIPv6(host)) return isBlockedIPv6(host);

  let addresses: Array<{ address: string }>;
  try {
    addresses = await resolve(host);
  } catch {
    // Unresolvable hostnames fail closed — the probe could not be vetted.
    return true;
  }
  if (addresses.length === 0) return true;
  return addresses.some(({ address }) =>
    isIPv4(address) ? isBlockedIPv4(address) : isBlockedIPv6(address),
  );
}

export interface AssertSafeCustomUrlOptions {
  policy?: SsrfPolicy;
  resolve?: HostResolver;
}

/**
 * Validate a user-supplied custom backend URL and reject private-network SSRF
 * targets according to the deployment policy. Preset environments are trusted
 * server configuration and bypass this guard entirely.
 */
export async function assertSafeCustomUrl(
  rawUrl: string,
  opts: AssertSafeCustomUrlOptions = {},
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ValidationError("Invalid backend URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError("Invalid backend URL.");
  }
  if (parsed.username || parsed.password) {
    throw new ValidationError("Invalid backend URL.");
  }

  if (opts.policy?.allowPrivateNetwork) return;

  if (await isBlockedHost(parsed.hostname, opts.resolve)) {
    throw new EnvironmentError(
      "The custom backend URL points to a private, loopback, or link-local network.",
    );
  }
}
