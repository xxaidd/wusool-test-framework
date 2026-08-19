import { describe, expect, it } from "vitest";
import { SessionImportError } from "@/shared/errors";
import {
  migrateSessionFile,
  MIN_SESSION_FORMAT_VERSION,
  SESSION_MIGRATIONS,
} from "./sessionMigrations";
import { SESSION_FORMAT_VERSION } from "./sessionSerializer";

describe("SESSION_MIGRATIONS", () => {
  it("is an ordered registry ending at the current version", () => {
    let expected = MIN_SESSION_FORMAT_VERSION;
    for (const entry of SESSION_MIGRATIONS) {
      expect(entry.from).toBe(expected);
      expected += 1;
    }
    expect(expected).toBe(SESSION_FORMAT_VERSION + 1);
  });
});

describe("migrateSessionFile", () => {
  it("passes a current-version payload through unchanged", () => {
    const raw = { formatVersion: SESSION_FORMAT_VERSION, events: [] };
    expect(migrateSessionFile(1, raw)).toBe(raw);
  });

  it("rejects files newer than this framework supports with an actionable message", () => {
    expect(() => migrateSessionFile(2, {})).toThrow(SessionImportError);
    expect(() => migrateSessionFile(2, {})).toThrow(/version 2/);
    expect(() => migrateSessionFile(2, {})).toThrow(/Supported versions: 1-1/);
  });

  it("rejects files older than the minimum version", () => {
    expect(() => migrateSessionFile(0, {})).toThrow(/too old/);
  });

  it("rejects a missing or non-numeric version", () => {
    expect(() => migrateSessionFile(undefined, {})).toThrow(
      /missing a valid format version/,
    );
    expect(() => migrateSessionFile("one", {})).toThrow(
      /missing a valid format version/,
    );
  });
});