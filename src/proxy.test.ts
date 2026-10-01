import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const createServerClient = vi.fn();
vi.mock("@supabase/ssr", () => ({ createServerClient }));

describe("proxy", () => {
  it("passes /api/keepalive through with no redirect and no Supabase session work", async () => {
    const { proxy } = await import("./proxy");
    const res = await proxy(new NextRequest("http://localhost/api/keepalive"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
