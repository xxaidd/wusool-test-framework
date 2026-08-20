import { describe, expect, it } from "vitest";
import { SessionImportError } from "@/shared/errors";
import {
  MIN_SESSION_FORMAT_VERSION,
  migrateSessionFile,
  SESSION_MIGRATIONS,
} from "./sessionMigrations";
import { SESSION_FORMAT_VERSION } from "./sessionSerializer";

describe("SESSION_MIGRATIONS", () => {
  it("is an ordered contiguous chain covering every version below the current one", () => {
    if (SESSION_MIGRATIONS.length === 0) {
      // With the current format at v1 there are no migrations yet.
      expect(MIN_SESSION_FORMAT_VERSION).toBe(SESSION_FORMAT_VERSION);
      return;
    }
    expect(SESSION_MIGRATIONS[0].from).toBe(MIN_SESSION_FORMAT_VERSION);
    for (let i = 1; i < SESSION_MIGRATIONS.length; i += 1) {
      expect(SESSION_MIGRATIONS[i].from).toBe(
        SESSION_MIGRATIONS[i - 1].from + 1,
      );
    }
    expect(SESSION_MIGRATIONS[SESSION_MIGRATIONS.length - 1].from + 1).toBe(
      SESSION_FORMAT_VERSION,
    );
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
