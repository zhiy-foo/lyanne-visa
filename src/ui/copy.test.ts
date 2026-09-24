import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// UI copy must stay neutral: "Lyanne" may only ever appear as part of the
// brand name "Lyanne Visa", never as a stand-in for "the child" in body copy.
const LYANNE_NOT_BRAND = /Lyanne(?!\s+Visa)/g;

export function findBareLyanneMentions(source: string): string[] {
  const matches = source.match(LYANNE_NOT_BRAND);
  return matches ?? [];
}

const EXCLUDED_FILES = [join("src", "ui", "fixtures.ts")];

function isExcluded(relativePath: string): boolean {
  if (EXCLUDED_FILES.includes(relativePath)) return true;
  if (relativePath.startsWith(join("src", "app", "dev") + sep)) return true;
  if (relativePath.endsWith(".test.ts") || relativePath.endsWith(".test.tsx")) return true;
  return false;
}

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

const repoRoot = join(__dirname, "..", "..");
const scanDirs = [join(repoRoot, "src", "ui"), join(repoRoot, "src", "app")];

describe("findBareLyanneMentions", () => {
  it("flags 'Add Lyanne' as a bare mention", () => {
    expect(findBareLyanneMentions("Add Lyanne so you can start planning their stays.")).toEqual([
      "Lyanne",
    ]);
  });

  it("accepts 'Lyanne Visa' as the brand name", () => {
    expect(findBareLyanneMentions("Welcome to Lyanne Visa")).toEqual([]);
  });
});

describe("src/ui and src/app copy stays child-name-neutral", () => {
  const files = scanDirs.flatMap((dir) => collectFiles(dir));

  it("found files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("only uses 'Lyanne' as part of the brand name 'Lyanne Visa'", () => {
    const violations: string[] = [];
    for (const file of files) {
      const relativePath = relative(repoRoot, file);
      if (isExcluded(relativePath)) continue;
      const source = readFileSync(file, "utf8");
      const mentions = findBareLyanneMentions(source);
      if (mentions.length > 0) {
        violations.push(`${relativePath} has ${mentions.length} bare "Lyanne" mention(s)`);
      }
    }
    expect(violations).toEqual([]);
  });
});
