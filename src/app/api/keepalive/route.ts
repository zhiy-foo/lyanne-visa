import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/stayover/supabase/server";

// Always evaluated per request — a cached response would defeat the point
// (see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md).
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Postgres SQLSTATE "insufficient_privilege". The anonymous role has no table
// grants (supabase/migrations/20260924000200_foundation_visibility.sql), so a
// healthy database answers the keepalive read with exactly this refusal —
// which still proves the request reached Postgres and counts as activity.
const PERMISSION_DENIED = "42501";

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
 * project never idles into a pause. One single-column, one-row select on `member` via the
 * publishable-key server client — no rows ever leave the handler, no secret key is
 * used, and nothing but `{ ok: true }` leaves this handler.
 */
export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE });
  }

  try {
    const supabase = await createClient();
    // Plain GET, not HEAD: postgrest-js cannot read an error body off a HEAD
    // response, so `error.code` would be undefined and the expected 42501
    // refusal would be indistinguishable from a real failure.
    const { error, status } = await supabase.from("member").select("id").limit(1);
    if (error && error.code !== PERMISSION_DENIED) {
      console.error("keepalive: Supabase read failed", { status, code: error.code, message: error.message });
      return NextResponse.json({ ok: false }, { status: 500, headers: NO_STORE });
    }
  } catch (err) {
    console.error("keepalive: Supabase read threw", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
