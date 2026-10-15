import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// "server-only" is not resolvable under plain Node (see
// src/delivery/trigger.test.ts); stub it in case the client helper pulls it in.
vi.mock("server-only", () => ({}));

const single = vi.fn();
const rpc = vi.fn(() => ({ single }));
const createClient = vi.fn();
vi.mock("@/stayover/supabase/server", () => ({ createClient }));

const SECRET = "s3cret-value";
const LAST = "2026-10-15T03:00:01.123+00:00";
const PREVIOUS = "2026-10-14T03:00:00.456+00:00";

async function call(headers?: Record<string, string>) {
  const { GET } = await import("./route");
  return GET(new Request("http://localhost/api/keepalive", { headers }));
}

const authed = { authorization: `Bearer ${SECRET}` };

type Result = {
  data?: { last_ping_at: string; previous_ping_at: string | null } | null;
  error: { code?: string; message: string } | null;
  status?: number;
};

function rpcResult(result: Result) {
  single.mockResolvedValue({ data: null, ...result });
}

function loggedText(): string {
  return JSON.stringify([
    (console.log as ReturnType<typeof vi.fn>).mock.calls,
    (console.error as ReturnType<typeof vi.fn>).mock.calls,
  ]);
}

describe("GET /api/keepalive", () => {
  const originalSecret = process.env.CRON_SECRET;
  const originalError = console.error;
  const originalLog = console.log;

  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    console.error = vi.fn();
    console.log = vi.fn();
    createClient.mockResolvedValue({ rpc });
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
    console.error = originalError;
    console.log = originalLog;
    vi.clearAllMocks();
  });

  it("401s with no Authorization header and never touches Supabase", async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false });
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("401s with a wrong secret", async () => {
    const res = await call({ authorization: "Bearer nope" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false });
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("401s when the scheme is missing", async () => {
    expect((await call({ authorization: SECRET })).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("401s when CRON_SECRET is unset, even for 'Bearer undefined'", async () => {
    delete process.env.CRON_SECRET;
    expect((await call({ authorization: "Bearer undefined" })).status).toBe(401);
    expect((await call({ authorization: "Bearer " })).status).toBe(401);
    expect((await call()).status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("401s when CRON_SECRET is empty", async () => {
    process.env.CRON_SECRET = "";
    expect((await call({ authorization: "Bearer " })).status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls keepalive_ping exactly once with the secret as token after a valid Bearer", async () => {
    rpcResult({ data: { last_ping_at: LAST, previous_ping_at: PREVIOUS }, error: null });
    await call(authed);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("keepalive_ping", { token: SECRET });
    expect(single).toHaveBeenCalledTimes(1);
  });

  it("200s with both times, logs 'keepalive: ok' with both times, and is no-store", async () => {
    rpcResult({ data: { last_ping_at: LAST, previous_ping_at: PREVIOUS }, error: null });
    const res = await call(authed);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, last_ping_at: LAST, previous_ping_at: PREVIOUS });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(console.log).toHaveBeenCalledWith("keepalive: ok", {
      last_ping_at: LAST,
      previous_ping_at: PREVIOUS,
    });
  });

  it("200s with a null previous_ping_at on the first run", async () => {
    rpcResult({ data: { last_ping_at: LAST, previous_ping_at: null }, error: null });
    const res = await call(authed);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, last_ping_at: LAST, previous_ping_at: null });
    expect(console.log).toHaveBeenCalledWith("keepalive: ok", {
      last_ping_at: LAST,
      previous_ping_at: null,
    });
  });

  it("500s with exactly { ok: false } on a 28000 refusal", async () => {
    rpcResult({ error: { code: "28000", message: "keepalive_ping: not authorised" }, status: 400 });
    const res = await call(authed);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(console.error).toHaveBeenCalledWith(
      "keepalive: Supabase ping failed",
      { status: 400, code: "28000", message: "keepalive_ping: not authorised" },
    );
  });

  it("500s on a generic Supabase error and logs only status, code and message", async () => {
    rpcResult({ error: { code: "PGRST000", message: "db unreachable" }, status: 503 });
    const res = await call(authed);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
    expect(console.error).toHaveBeenCalledWith("keepalive: Supabase ping failed", {
      status: 503,
      code: "PGRST000",
      message: "db unreachable",
    });
  });

  it("500s on a 42501 error (formerly treated as success)", async () => {
    rpcResult({ error: { code: "42501", message: "permission denied for function keepalive_ping" }, status: 403 });
    const res = await call(authed);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
    expect(console.error).toHaveBeenCalled();
  });

  it("500s on an error with no code (e.g. a fetch failure)", async () => {
    rpcResult({ error: { message: "TypeError: fetch failed" } });
    const res = await call(authed);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
  });

  it("500s when there is neither an error nor data", async () => {
    rpcResult({ data: null, error: null });
    const res = await call(authed);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
  });

  it("500s when creating the client throws", async () => {
    createClient.mockRejectedValue(new Error("Missing required environment variable"));
    const res = await call(authed);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
    expect(console.error).toHaveBeenCalled();
  });

  it("500s when the rpc call throws", async () => {
    single.mockRejectedValue(new Error("network down"));
    const res = await call(authed);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
  });

  it("never logs the secret on success", async () => {
    rpcResult({ data: { last_ping_at: LAST, previous_ping_at: PREVIOUS }, error: null });
    await call(authed);
    expect(loggedText()).not.toContain(SECRET);
  });

  it("never logs or returns the secret on error and throw paths", async () => {
    const bodies: string[] = [];
    rpcResult({ error: { code: "28000", message: "keepalive_ping: not authorised" }, status: 400 });
    bodies.push(await (await call(authed)).text());
    single.mockRejectedValue(new Error(`boom with ${SECRET} inside`));
    bodies.push(await (await call(authed)).text());
    createClient.mockRejectedValue(new Error(`client failed ${SECRET}`));
    bodies.push(await (await call(authed)).text());
    expect(loggedText()).not.toContain(SECRET);
    for (const body of bodies) expect(body).not.toContain(SECRET);
  });
});
