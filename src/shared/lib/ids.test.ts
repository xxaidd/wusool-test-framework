import { describe, expect, it } from "vitest";
import { createId } from "./ids";

describe("createId", () => {
  it("produces a prefixed identifier", () => {
    expect(createId("req")).toMatch(/^req_\d+_\d+_/);
    expect(createId("ev")).toMatch(/^ev_\d+_\d+_/);
  });

  it("is unique across many calls", () => {
    const ids = new Set(Array.from({ length: 500 }, () => createId("x")));
    expect(ids.size).toBe(500);
  });
});
