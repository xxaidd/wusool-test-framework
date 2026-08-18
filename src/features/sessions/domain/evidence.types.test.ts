import { describe, expect, it } from "vitest";
import {
  REDACTED,
  redactRequest,
  redactResponse,
} from "@/shared/redaction/redact";
import type { ExecutionRecord, FailureClassification } from "./evidence.types";

describe("ExecutionRecord", () => {
  it("only accepts sanitized request/response produced by the redaction module", () => {
    const request = redactRequest({
      method: "POST",
      path: "/api/v1/auth/login",
      headers: {
        Authorization: "Bearer secret-token",
        "Content-Type": "application/json",
      },
      body: { email: "a@b.c", password: "hunter2" },
    });
    const response = redactResponse({
      statusCode: 200,
      headers: {},
      body: { accessToken: "abc", userId: 7 },
    });

    const record: ExecutionRecord = {
      requestId: "req_1",
      executionId: "ex_1",
      environmentId: "local",
      actorId: "7",
      actionId: "passenger.reserve",
      startedAt: "2024-01-01T00:00:00.000Z",
      durationMs: 12,
      request,
      response,
      correlation: { traceId: "trace-1" },
      classification: { kind: "success" },
    };

    expect(record.request.headers.Authorization).toBe(REDACTED);
    expect(record.request.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(record.request.body ?? "{}")).toEqual({
      email: "a@b.c",
      password: REDACTED,
    });
    expect(JSON.parse(record.response?.body ?? "{}")).toEqual({
      accessToken: REDACTED,
      userId: 7,
    });
    expect(record.correlation).toEqual({ traceId: "trace-1" });
  });

  it("carries a discriminated failure classification", () => {
    const authFailure: FailureClassification = {
      kind: "authorization",
      needsAuth: true,
    };
    const infraFailure: FailureClassification = {
      kind: "infrastructure",
      subtype: "timeout",
    };

    if (authFailure.kind === "authorization")
      expect(authFailure.needsAuth).toBe(true);
    if (infraFailure.kind === "infrastructure")
      expect(infraFailure.subtype).toBe("timeout");
  });
});
