import { describe, expect, it } from "vitest";
import { AppError } from "./AppError";
import { classifyError, classifyHttpStatus } from "./classification";

describe("classifyHttpStatus", () => {
  it("classifies success as success", () => {
    expect(classifyHttpStatus(200)).toEqual({ kind: "success" });
    expect(classifyHttpStatus(201)).toEqual({ kind: "success" });
  });

  it("classifies 401/403 as authorization", () => {
    expect(classifyHttpStatus(401)).toEqual({
      kind: "authorization",
      needsAuth: false,
    });
    expect(classifyHttpStatus(401, true)).toEqual({
      kind: "authorization",
      needsAuth: true,
    });
    expect(classifyHttpStatus(403)).toEqual({
      kind: "authorization",
      needsAuth: false,
    });
  });

  it("classifies other client errors as business", () => {
    expect(classifyHttpStatus(400)).toEqual({ kind: "business" });
    expect(classifyHttpStatus(409)).toEqual({ kind: "business" });
  });

  it("classifies server errors as backend-unavailable", () => {
    expect(classifyHttpStatus(500)).toEqual({
      kind: "infrastructure",
      subtype: "backend-unavailable",
    });
    expect(classifyHttpStatus(503)).toEqual({
      kind: "infrastructure",
      subtype: "backend-unavailable",
    });
  });
});

describe("classifyError", () => {
  it("maps AppError codes", () => {
    expect(classifyError(new AppError("AUTHENTICATION", "auth"))).toEqual({
      kind: "authorization",
      needsAuth: true,
    });
    expect(classifyError(new AppError("VALIDATION", "bad"))).toEqual({
      kind: "validation",
    });
    expect(classifyError(new AppError("BACKEND_UNAVAILABLE", "down"))).toEqual({
      kind: "infrastructure",
      subtype: "backend-unavailable",
    });
    expect(classifyError(new AppError("ACTION_EXECUTION", "boom"))).toEqual({
      kind: "business",
    });
  });

  it("classifies aborted operations as cancelled", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(classifyError(err)).toEqual({
      kind: "infrastructure",
      subtype: "cancelled",
    });
  });

  it("classifies timeouts and network failures", () => {
    expect(classifyError(new Error("request timed out"))).toEqual({
      kind: "infrastructure",
      subtype: "timeout",
    });
    expect(classifyError(new Error("ECONNREFUSED"))).toEqual({
      kind: "infrastructure",
      subtype: "backend-unavailable",
    });
  });

  it("classifies unknown errors as network infrastructure failure", () => {
    expect(classifyError(new Error("weird"))).toEqual({
      kind: "infrastructure",
      subtype: "network",
    });
  });
});
