import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// src/ui must stay presentational: no server code, no routing, no Supabase.
const FORBIDDEN_PATTERNS = [
  /^@supabase\//,
  /^server-only$/,
  /^next\/headers$/,
  /^next\/navigation$/,
  /^@\/stayover\//,
];

export function isForbiddenImport(specifier: string): boolean {
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(specifier));
}

const IMPORT_SPECIFIER = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

function extractSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = IMPORT_SPECIFIER.exec(source)) !== null) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      files.push(full);
    }
  }
  return files;
}

const uiDir = join(__dirname); // src/ui

describe("isForbiddenImport", () => {
  it("catches @supabase/* imports", () => {
    expect(isForbiddenImport("@supabase/supabase-js")).toBe(true);
  });

  it("catches server-only", () => {
    expect(isForbiddenImport("server-only")).toBe(true);
  });

  it("catches next/headers and next/navigation", () => {
    expect(isForbiddenImport("next/headers")).toBe(true);
    expect(isForbiddenImport("next/navigation")).toBe(true);
  });

  it("catches @/stayover/* imports", () => {
    expect(isForbiddenImport("@/stayover/db")).toBe(true);
  });

  it("allows ordinary presentational imports", () => {
    expect(isForbiddenImport("react")).toBe(false);
    expect(isForbiddenImport("./Button")).toBe(false);
    expect(isForbiddenImport("next/font/google")).toBe(false);
  });
});

describe("src/ui boundary", () => {
  const files = collectFiles(uiDir);

  it("found files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("imports nothing server-only, routing- or Supabase-related", () => {
    const violations: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const specifier of extractSpecifiers(source)) {
        if (isForbiddenImport(specifier)) {
          violations.push(`${relative(process.cwd(), file)} imports "${specifier}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
