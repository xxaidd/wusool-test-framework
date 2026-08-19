import { describe, expect, it } from "vitest";
import { errorResponseFixture } from "@/infrastructure/contracts/__fixtures__/errors";
import { parseErrorTraceAndPath, ServerApiError } from "./wusoolServerClient";

describe("parseErrorTraceAndPath", () => {
  it("extracts traceId and path from an ErrorResponse-shaped body", () => {
    expect(parseErrorTraceAndPath(errorResponseFixture)).toEqual({
      traceId: "0HNSAMPLE0001:00000001",
      path: "/api/v1/stops",
    });
  });

  it("returns empty fields for non-object bodies", () => {
    expect(parseErrorTraceAndPath("plain string")).toEqual({});
    expect(parseErrorTraceAndPath(null)).toEqual({});
  });

  it("ignores missing trace fields", () => {
    expect(parseErrorTraceAndPath({ message: "boom" })).toEqual({});
  });
});

describe("ServerApiError", () => {
  it("carries traceId and path", () => {
    const err = new ServerApiError(
      401,
      "Authentication is required.",
      "UNAUTHORIZED",
      errorResponseFixture,
      {},
      errorResponseFixture.traceId ?? undefined,
      errorResponseFixture.path ?? undefined,
    );
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.traceId).toBe("0HNSAMPLE0001:00000001");
    expect(err.path).toBe("/api/v1/stops");
  });
});
