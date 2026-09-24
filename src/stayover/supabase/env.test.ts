import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { requiredEnv, siteUrl, supabasePublishableKey, supabaseUrl } from "./env";

const SRC_ROOT = join(__dirname, "..", "..");

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...listSourceFiles(path));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(path);
    }
  }
  return files;
}

// Built from parts so this guard file doesn't itself contain the literal
// text it forbids (which would make it fail its own scan).
const DYNAMIC_ENV_ACCESS = /process\.env\[/;
const FORBIDDEN_SAMPLE = ["process", ".env", "[", "name", "]"].join("");

describe("dynamic process.env access", () => {
  it("would be caught by the matcher used below", () => {
    // Sanity check that the regression guard's pattern actually matches
    // the dynamic-access form it exists to forbid, e.g. process.env[name].
    const sample = `const value = ${FORBIDDEN_SAMPLE};`;
    expect(DYNAMIC_ENV_ACCESS.test(sample)).toBe(true);
  });

  it("is never used anywhere under src/, because Next.js only inlines NEXT_PUBLIC_* vars that are referenced statically", () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(SRC_ROOT)) {
      if (file === __filename) continue;
      const contents = readFileSync(file, "utf-8");
      if (DYNAMIC_ENV_ACCESS.test(contents)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("requiredEnv / supabaseUrl / supabasePublishableKey / siteUrl", () => {
  it("throws the same missing-variable error requiredEnv would throw, when the underlying env var is unset", () => {
    const original = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      site: process.env.NEXT_PUBLIC_SITE_URL,
    };
    try {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      delete process.env.NEXT_PUBLIC_SITE_URL;

      expect(() => requiredEnv("NEXT_PUBLIC_SUPABASE_URL")).toThrow(
        "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL",
      );
      expect(() => supabaseUrl()).toThrow(
        "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL",
      );
      expect(() => supabasePublishableKey()).toThrow(
        "Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      );
      expect(() => siteUrl()).toThrow(
        "Missing required environment variable: NEXT_PUBLIC_SITE_URL",
      );
    } finally {
      if (original.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = original.url;
      if (original.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = original.key;
      if (original.site === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = original.site;
    }
  });

  it("returns the value when the underlying env var is set", () => {
    const original = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      expect(supabaseUrl()).toBe("https://example.supabase.co");
      expect(requiredEnv("NEXT_PUBLIC_SUPABASE_URL")).toBe(
        "https://example.supabase.co",
      );
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = original;
    }
  });
});
