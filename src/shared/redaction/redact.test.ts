import { describe, expect, it } from "vitest";
import {
  isSensitiveKey,
  REDACTED,
  redact,
  redactHeaders,
  redactRequest,
  redactResponse,
  redactStringifiedBody,
} from "./redact";

describe("redact", () => {
  it("redacts values under sensitive keys at any depth", () => {
    const value = {
      email: "a@b.c",
      password: "hunter2",
      profile: { confirmPassword: "hunter2", nickname: "alice" },
    };
    expect(redact(value)).toEqual({
      email: "a@b.c",
      password: REDACTED,
      profile: { confirmPassword: REDACTED, nickname: "alice" },
    });
  });

  it("redacts tokens and credentials objects", () => {
    expect(redact({ accessToken: "abc", refreshToken: "x" })).toEqual({
      accessToken: REDACTED,
      refreshToken: REDACTED,
    });
    expect(redact({ credentials: { password: "p" } })).toEqual({
      credentials: REDACTED,
    });
  });

  it("traverses arrays", () => {
    expect(redact([{ apiKey: "k", name: "n" }])).toEqual([
      { apiKey: REDACTED, name: "n" },
    ]);
  });

  it("leaves non-sensitive values intact", () => {
    const value = { id: 7, name: "alice", active: true };
    expect(redact(value)).toEqual(value);
    expect(redact("plain")).toBe("plain");
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
  });

  it("is idempotent", () => {
    const value = { password: "p", data: { token: "t", x: 1 } };
    expect(redact(redact(value))).toEqual(redact(value));
  });
});

describe("isSensitiveKey", () => {
  it("matches secret-ish keys case-insensitively", () => {
    for (const key of [
      "password",
      "confirmPassword",
      "accessToken",
      "refresh_token",
      "Authorization",
      "Set-Cookie",
      "x-api-key",
      "apiKey",
      "cookie",
      "credentials",
      "session",
      "secret",
    ]) {
      expect(isSensitiveKey(key)).toBe(true);
    }
  });

  it("does not match ordinary keys", () => {
    for (const key of ["email", "name", "id", "status", "boarded", "payload"]) {
      expect(isSensitiveKey(key)).toBe(false);
    }
  });
});

describe("redactHeaders", () => {
  it("redacts sensitive header names and keeps others", () => {
    const headers = {
      Authorization: "Bearer abc",
      "Content-Type": "application/json",
      Cookie: "sid=1",
      "X-Api-Key": "k",
    };
    expect(redactHeaders(headers)).toEqual({
      Authorization: REDACTED,
      "Content-Type": "application/json",
      Cookie: REDACTED,
      "X-Api-Key": REDACTED,
    });
  });
});

describe("redactRequest / redactResponse", () => {
  it("sanitizes a request including headers, query, and body", () => {
    const req = redactRequest({
      method: "POST",
      url: "http://backend/api/v1/auth/login",
      headers: {
        Authorization: "Bearer tok",
        "Content-Type": "application/json",
      },
      query: { token: "q" },
      body: { email: "a@b.c", password: "hunter2" },
    });
    expect(req).toMatchObject({
      method: "POST",
      path: "http://backend/api/v1/auth/login",
      headers: { Authorization: REDACTED },
    });
    expect(req.query?.token).toBe(REDACTED);
    expect(JSON.parse(req.body ?? "{}")).toEqual({
      email: "a@b.c",
      password: REDACTED,
    });
  });

  it("sanitizes an already-stringified JSON body", () => {
    const req = redactRequest({
      method: "POST",
      path: "/x",
      body: JSON.stringify({ accessToken: "abc", count: 2 }),
    });
    expect(JSON.parse(req.body ?? "{}")).toEqual({
      accessToken: REDACTED,
      count: 2,
    });
  });

  it("sanitizes a response body", () => {
    const res = redactResponse({
      statusCode: 200,
      headers: { "Set-Cookie": "sid=1" },
      body: { refreshToken: "r", items: [{ id: 1 }] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["Set-Cookie"]).toBe(REDACTED);
    expect(JSON.parse(res.body ?? "{}")).toEqual({
      refreshToken: REDACTED,
      items: [{ id: 1 }],
    });
  });
});

describe("redactStringifiedBody", () => {
  it("redacts object bodies and passes through non-JSON strings", () => {
    expect(JSON.parse(redactStringifiedBody({ token: "t", n: 1 }))).toEqual({
      token: REDACTED,
      n: 1,
    });
    expect(redactStringifiedBody("not json")).toBe("not json");
  });
});
