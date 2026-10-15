import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/stayover/supabase/server";

// Always evaluated per request — a cached response would defeat the point
// (see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md).
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

interface KeepalivePing {
  last_ping_at: string;
  previous_ping_at: string | null;
}

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed: with no secret configured nothing can match.
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * `keepalive` (docs/stayover/ARCHITECTURE.md §7): called daily by Vercel Cron
 * (vercel.json) with `Authorization: Bearer $CRON_SECRET` so the free Supabase
 * project never idles into a pause. After the Bearer check it calls the
 * password-locked `keepalive_ping(token)` RPC with `CRON_SECRET` through the
 * publishable-key server client, which makes one real write to the singleton
 * `keepalive_heartbeat` row — no secret key is used. Any error or throw (the
 * database refusing the token included) is a 500 `{ ok: false }`; only on
 * success are the two ping times returned. The token is never logged or returned.
 */
export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  }

  try {
    const supabase = await createClient();
    const { data, error, status } = await supabase
      .rpc("keepalive_ping", { token: process.env.CRON_SECRET })
      .single();
    if (error || !data) {
      console.error("keepalive: Supabase ping failed", {
        status,
        code: error?.code,
        message: error?.message,
      });
      return NextResponse.json({ ok: false }, { status: 500, headers: NO_STORE });
    }
    // The client is untyped (no generated DB types), so name the RPC's return shape here.
    const { last_ping_at, previous_ping_at } = data as KeepalivePing;
    console.log("keepalive: ok", { last_ping_at, previous_ping_at });
    return NextResponse.json(
      { ok: true, last_ping_at, previous_ping_at },
      { headers: NO_STORE },
    );
  } catch {
    // Deliberately drops the thrown value: it could carry request details.
    console.error("keepalive: Supabase ping threw");
    return NextResponse.json({ ok: false }, { status: 500, headers: NO_STORE });
  }
}
