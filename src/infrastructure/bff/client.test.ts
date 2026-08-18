import axios, { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bffRequest } from "./client";

describe("bffRequest", () => {
  beforeEach(() => {
    vi.spyOn(axios, "post").mockReset();
  });

  it("unwraps the success envelope", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { ok: true, data: { a: 1 } },
    } as never);
    await expect(bffRequest<{ a: number }>("/x", {})).resolves.toEqual({
      a: 1,
    });
  });

  it("returns non-envelope payloads as-is", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { items: [] },
    } as never);
    await expect(bffRequest<{ items: unknown[] }>("/x", {})).resolves.toEqual({
      items: [],
    });
  });

  it("throws BffError on a failure envelope", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      status: 200,
      data: { ok: false, error: { code: "VALIDATION", message: "bad" } },
    } as never);
    await expect(bffRequest("/x", {})).rejects.toMatchObject({
      name: "BffError",
      code: "VALIDATION",
      message: "bad",
    });
  });

  it("throws BffError on an HTTP error with a structured body", async () => {
    const error = new AxiosError("boom", undefined, undefined, undefined, {
      status: 500,
      statusText: "Internal Server Error",
      headers: {},
      config: {} as never,
      data: { error: { code: "BACKEND", message: "nope" } },
    });
    vi.spyOn(axios, "post").mockRejectedValue(error);
    await expect(bffRequest("/x", {})).rejects.toMatchObject({
      name: "BffError",
      status: 500,
      code: "BACKEND",
      message: "nope",
    });
  });

  it("throws BffError on network errors", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("network down"));
    await expect(bffRequest("/x", {})).rejects.toMatchObject({
      name: "BffError",
      message: "network down",
    });
  });
});
