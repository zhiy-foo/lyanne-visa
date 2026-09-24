import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the bug fixed in
 * 20260924000500_set_join_code_where.sql: Supabase's hosted Postgres runs
 * the pg-safeupdate extension, which rejects any UPDATE/DELETE issued over
 * the API without a WHERE clause. Our PGlite test database has no such
 * guard, so a WHERE-less update/delete inside a SECURITY DEFINER function
 * passes every existing test yet fails live. This file statically checks
 * every migration for that shape so it cannot happen again silently.
 *
 * Parsing approach and its limits: this is NOT a SQL parser. It strips `--`
 * line comments, then treats every `;`-terminated chunk of a file as one
 * statement — true for both top-level DDL and the individual statements
 * inside a plpgsql function body, since those are also `;`-terminated. A
 * chunk is flagged if it starts with `update` or `delete from` (after
 * trimming) and contains no `where` anywhere in it. This will not catch a
 * `where` hidden inside a string literal or block comment (none of our
 * migrations do that), and it does not understand nested dollar-quoting
 * other than the plain `$$ ... $$` this codebase uses throughout (verified
 * by grep — see AGENTS.md conventions). It is deliberately simple; treat a
 * failure here as "go look", not as gospel.
 *
 * Superseding: a function redefined by a later migration's
 * `create or replace function` of the same name is expected to change —
 * that's the whole point of a fix migration — so only the LATEST
 * definition of a given function name (by migration filename order) is
 * checked; earlier definitions of a since-replaced function are exempt.
 * Statements outside any function body (plain DDL) are always checked, with
 * no exemption.
 */

const MIGRATIONS_DIR = join(__dirname, "..", "..", "supabase", "migrations");

function stripLineComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
}

interface FunctionBlock {
  file: string;
  name: string;
  body: string;
  start: number;
  end: number;
}

// Matches `create [or replace] function <schema.name>(...) ... as $$ <body> $$`
// — non-greedy so it stops at the first `$$ ... $$` pair following the
// signature, which is exactly how every function in this codebase is
// written (language sql or plpgsql, single dollar-quoted body).
const FUNCTION_REGEX =
  /create\s+(?:or\s+replace\s+)?function\s+([a-zA-Z_][\w.]*)\s*\([^)]*\)[\s\S]*?\$\$([\s\S]*?)\$\$/gi;

function findFunctionBlocks(file: string, content: string): FunctionBlock[] {
  const blocks: FunctionBlock[] = [];
  const regex = new RegExp(FUNCTION_REGEX);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      file,
      name: match[1].toLowerCase(),
      body: match[2],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return blocks;
}

/** Every `;`-terminated chunk of `text` that is an update/delete missing a
 * `where` clause, as trimmed statement text (for readable failure output). */
function findStatementsMissingWhere(text: string): string[] {
  const bad: string[] = [];
  for (const rawChunk of text.split(";")) {
    const chunk = rawChunk.trim();
    if (/^update\s/i.test(chunk) || /^delete\s+from\s/i.test(chunk)) {
      if (!/\bwhere\b/i.test(chunk)) {
        bad.push(chunk);
      }
    }
  }
  return bad;
}

/** Content of `content` with every function-block span removed, leaving
 * only top-level statements (create table, alter table, insert, grant,
 * revoke, and any bare update/delete not inside a function). */
function removeFunctionBlocks(content: string, blocks: FunctionBlock[]): string {
  let result = content;
  // Remove from the end so earlier indices stay valid.
  for (const block of [...blocks].sort((a, b) => b.start - a.start)) {
    result = result.slice(0, block.start) + result.slice(block.end);
  }
  return result;
}

function loadMigrationFiles(): { file: string; content: string }[] {
  let names: string[] = [];
  try {
    names = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith(".sql"))
      .sort();
  } catch {
    names = [];
  }
  return names.map((file) => ({
    file,
    content: stripLineComments(readFileSync(join(MIGRATIONS_DIR, file), "utf8")),
  }));
}

/** For every function name, the index (into `files`, filename order) of its
 * LAST definition — the one that is actually live and should be checked. */
function latestDefinitionIndex(
  files: { file: string; content: string }[],
  blocksByFile: FunctionBlock[][],
): Map<string, number> {
  const latest = new Map<string, number>();
  files.forEach((_, fileIndex) => {
    for (const block of blocksByFile[fileIndex]) {
      const current = latest.get(block.name);
      if (current === undefined || fileIndex > current) {
        latest.set(block.name, fileIndex);
      }
    }
  });
  return latest;
}

describe("migrations never update/delete without a WHERE clause", () => {
  it("the checker itself: flags a bare update, accepts one with a WHERE clause", () => {
    expect(findStatementsMissingWhere(`update public.x set a = 1;`)).toEqual([
      "update public.x set a = 1",
    ]);
    expect(findStatementsMissingWhere(`update public.x set a = 1 where id = true;`)).toEqual([]);
    expect(findStatementsMissingWhere(`delete from public.x;`)).toEqual(["delete from public.x"]);
    expect(findStatementsMissingWhere(`delete from public.x where id = 1;`)).toEqual([]);
  });

  it("every currently-live migration statement has a WHERE clause on its update/delete", () => {
    const files = loadMigrationFiles();
    const blocksByFile = files.map(({ file, content }) => findFunctionBlocks(file, content));
    const latest = latestDefinitionIndex(files, blocksByFile);

    const failures: string[] = [];

    files.forEach(({ file, content }, fileIndex) => {
      const blocks = blocksByFile[fileIndex];

      // Top-level statements (outside every function body) are always checked.
      const outside = removeFunctionBlocks(content, blocks);
      for (const bad of findStatementsMissingWhere(outside)) {
        failures.push(`${file} (top-level): ${bad}`);
      }

      // Only the latest definition of each function name is checked —
      // earlier, superseded definitions are expected to differ from the fix
      // that replaced them.
      for (const block of blocks) {
        if (latest.get(block.name) !== fileIndex) {
          continue; // superseded by a later migration's create or replace
        }
        for (const bad of findStatementsMissingWhere(block.body)) {
          failures.push(`${file} (function ${block.name}): ${bad}`);
        }
      }
    });

    expect(failures).toEqual([]);
  });

  it("sanity check: parses at least the known functions, and treats set_join_code's fix as the live definition", () => {
    const files = loadMigrationFiles();
    const blocksByFile = files.map(({ file, content }) => findFunctionBlocks(file, content));
    const latest = latestDefinitionIndex(files, blocksByFile);

    const setJoinCodeLatest = latest.get("public.set_join_code");
    expect(setJoinCodeLatest).toBeDefined();
    expect(files[setJoinCodeLatest as number].file).toBe("20260924000500_set_join_code_where.sql");

    // The superseded (000300) definition is still parsed — it's just
    // excluded from the WHERE check above — proving the exemption is
    // "skip this one" and not "the parser missed it".
    const registerBlocks = blocksByFile.flatMap((blocks) =>
      blocks.filter((b) => b.name === "public.set_join_code"),
    );
    expect(registerBlocks.length).toBeGreaterThanOrEqual(2);
  });
});
