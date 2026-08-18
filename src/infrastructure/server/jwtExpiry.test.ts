import { describe, expect, it } from "vitest";
import { extractExpiry } from "./jwtExpiry";

function makeToken(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${encoded}.signature`;
}

describe("extractExpiry", () => {
  it("returns the exp claim in milliseconds", () => {
    expect(extractExpiry(makeToken({ exp: 1893456000, sub: "7" }))).toBe(
      1893456000 * 1000,
    );
  });

  it("returns undefined when the exp claim is missing", () => {
    expect(extractExpiry(makeToken({ sub: "7" }))).toBeUndefined();
  });

  it("returns undefined for a non-numeric exp", () => {
    expect(extractExpiry(makeToken({ exp: "soon" }))).toBeUndefined();
  });

  it("returns undefined for a malformed token", () => {
    expect(extractExpiry("not-a-jwt")).toBeUndefined();
    expect(extractExpiry("")).toBeUndefined();
    expect(extractExpiry("a.b.c.extra")).toBeUndefined();
  });
});
