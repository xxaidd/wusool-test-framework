import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const SCOPED_DIRS = [
  "src/features",
  "src/shared/redaction",
  "src/shared/errors",
  "src/shared/lib",
];

function isBoundaryFile(rel: string): boolean {
  const normalized = rel.split(path.sep).join("/");
  if (
    normalized.startsWith("src/shared/redaction/") ||
    normalized.startsWith("src/shared/errors/") ||
    normalized.startsWith("src/shared/lib/")
  ) {
    return true;
  }
  return /^src\/features\/[^/]+\/(domain|application)\//.test(normalized);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function isForbiddenSpecifier(spec: string): boolean {
  if (/^(react|react-dom|react-leaflet)(\/|$)/.test(spec)) return true;
  if (/^next(\/|$)/.test(spec)) return true;
  if (/^axios(\/|$)/.test(spec)) return true;
  if (/^leaflet(\/|$)/.test(spec)) return true;
  if (/^zustand(\/|$)/.test(spec)) return true;
  if (/^@\/shared\/store(\/|$)/.test(spec)) return true;
  if (/\/(presentation|infrastructure)\//.test(spec)) return true;
  return false;
}

describe("architectural boundaries", () => {
  it("domain/application and shared core modules stay framework-free", () => {
    const violations: string[] = [];

    for (const dir of SCOPED_DIRS) {
      const abs = path.join(ROOT, dir);
      for (const file of walk(abs)) {
        const rel = path.relative(ROOT, file);
        if (!isBoundaryFile(rel)) continue;
        const content = fs.readFileSync(file, "utf8");
        const specifierRe = /\bfrom\s+['"]([^'"]+)['"]/g;
        for (const match of content.matchAll(specifierRe)) {
          const spec = match[1];
          if (isForbiddenSpecifier(spec)) {
            violations.push(`${rel} imports "${spec}"`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
