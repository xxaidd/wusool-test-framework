// Dependency-free architectural boundary audit.
// Mirrors the `rg` check from the Task 0.3 plan: no domain/application module
// may import framework, browser, Zustand store, or presentation/infrastructure
// internals. Stores must stay client-side (no server/BFF route imports).
// BFF route handlers must stay server-side (no browser BFF client imports).
// Exit 0 when clean, 1 when violations exist.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scopedDirs = [
  "src/features",
  "src/shared/redaction",
  "src/shared/errors",
  "src/shared/lib",
  "src/shared/store",
  "src/app/api",
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function normalize(rel) {
  return rel.split(path.sep).join("/");
}

function isCoreBoundaryFile(rel) {
  const normalized = normalize(rel);
  if (
    normalized.startsWith("src/shared/redaction/") ||
    normalized.startsWith("src/shared/errors/") ||
    normalized.startsWith("src/shared/lib/")
  ) {
    return true;
  }
  return /^src\/features\/[^/]+\/(domain|application)\//.test(normalized);
}

function isStoreFile(rel) {
  return normalize(rel).startsWith("src/shared/store/");
}

function isRouteFile(rel) {
  return normalize(rel).startsWith("src/app/api/");
}

function isCoreForbiddenSpecifier(spec) {
  if (/^(react|react-dom|react-leaflet)(\/|$)/.test(spec)) return true;
  if (/^next(\/|$)/.test(spec)) return true;
  if (/^axios(\/|$)/.test(spec)) return true;
  if (/^leaflet(\/|$)/.test(spec)) return true;
  if (/^zustand(\/|$)/.test(spec)) return true;
  if (/^@\/shared\/store(\/|$)/.test(spec)) return true;
  if (/\/(presentation|infrastructure)\//.test(spec)) return true;
  return false;
}

function isStoreForbiddenSpecifier(spec) {
  if (/^@\/infrastructure\/server(\/|$)/.test(spec)) return true;
  if (/^@\/app\/api(\/|$)/.test(spec)) return true;
  if (/^next(\/|$)/.test(spec)) return true;
  if (/^leaflet(\/|$)/.test(spec)) return true;
  return false;
}

function isRouteForbiddenSpecifier(spec) {
  if (/^@\/infrastructure\/bff(\/|$)/.test(spec)) return true;
  if (/^@\/shared\/store(\/|$)/.test(spec)) return true;
  return false;
}

const violations = [];
const specifierRe = /\bfrom\s+['"]([^'"]+)['"]/g;

for (const dir of scopedDirs) {
  const abs = path.join(root, dir);
  for (const file of walk(abs)) {
    const rel = path.relative(root, file);
    const content = fs.readFileSync(file, "utf8");
    let forbidden;
    if (isCoreBoundaryFile(rel)) forbidden = isCoreForbiddenSpecifier;
    else if (isStoreFile(rel)) forbidden = isStoreForbiddenSpecifier;
    else if (isRouteFile(rel)) forbidden = isRouteForbiddenSpecifier;
    else continue;

    for (const match of content.matchAll(specifierRe)) {
      const spec = match[1];
      if (forbidden(spec)) {
        violations.push(`${rel} imports "${spec}"`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Architectural boundary violations:");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log("Architectural boundaries clean.");
