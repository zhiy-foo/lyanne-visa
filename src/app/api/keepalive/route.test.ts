import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// "server-only" is not resolvable under plain Node (see
// src/delivery/trigger.test.ts); stub it in case the client helper pulls it in.
vi.mock("server-only", () => ({}));

const select = vi.fn();
const from = vi.fn(() => ({ select }));
const createClient = vi.fn();
vi.mock("@/stayover/supabase/server", () => ({ createClient }));

const SECRET = "s3cret-value";

async function call(headers?: Record<string, string>) {
  const { GET } = await import("./route");
  return GET(new Request("http://localhost/api/keepalive", { headers }));
}

function headResult(result: { error: { code?: string; message: string } | null }) {
  select.mockReturnValue({ limit: vi.fn().mockResolvedValue(result) });
}

describe("GET /api/keepalive", () => {
  const originalSecret = process.env.CRON_SECRET;
  const originalError = console.error;

  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    console.error = vi.fn();
    createClient.mockResolvedValue({ from });
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
    console.error = originalError;
    vi.clearAllMocks();
  });

  it("401s with no Authorization header and never touches Supabase", async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("401s with a wrong secret", async () => {
    const res = await call({ authorization: "Bearer nope" });
    expect(res.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("401s when the scheme is missing", async () => {
    expect((await call({ authorization: SECRET })).status).toBe(401);
  });

  it("401s when CRON_SECRET is unset, even for 'Bearer undefined'", async () => {
    delete process.env.CRON_SECRET;
    expect((await call({ authorization: "Bearer undefined" })).status).toBe(401);
    expect((await call({ authorization: "Bearer " })).status).toBe(401);
    expect((await call()).status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("401s when CRON_SECRET is empty", async () => {
    process.env.CRON_SECRET = "";
    expect((await call({ authorization: "Bearer " })).status).toBe(401);
  });

  it("200s with only { ok: true } on success, via a head select on member", async () => {
    headResult({ error: null });
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(from).toHaveBeenCalledWith("member");
    expect(select).toHaveBeenCalledWith("*", { count: "exact", head: true });
  });

  it("200s when Postgres answers with the expected permission refusal", async () => {
    headResult({ error: { code: "42501", message: "permission denied for table member" } });
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("500s on any other Supabase error, leaking nothing", async () => {
    headResult({ error: { code: "PGRST000", message: "db unreachable" } });
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
  });

  it("500s on an error with no code (e.g. a fetch failure)", async () => {
    headResult({ error: { message: "TypeError: fetch failed" } });
    expect((await call({ authorization: `Bearer ${SECRET}` })).status).toBe(500);
  });

  it("500s when creating the client throws", async () => {
    createClient.mockRejectedValue(new Error("Missing required environment variable"));
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
  });
});
