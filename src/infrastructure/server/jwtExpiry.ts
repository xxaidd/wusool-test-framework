function padBase64Url(value: string): string {
  return (
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4)
  );
}

/**
 * Best-effort extraction of the `exp` claim (ms since epoch) from a JWT access
 * token payload. Returns `undefined` for malformed tokens or when the claim is
 * missing, so callers can treat it as "no expiry known".
 */
export function extractExpiry(accessToken: string): number | undefined {
  const payload = accessToken.split(".")[1];
  if (!payload) return undefined;
  let decoded: string;
  try {
    decoded = atob(padBase64Url(payload));
  } catch {
    return undefined;
  }
  try {
    const parsed = JSON.parse(decoded) as { exp?: unknown };
    if (typeof parsed.exp === "number" && Number.isFinite(parsed.exp)) {
      return parsed.exp * 1000;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
