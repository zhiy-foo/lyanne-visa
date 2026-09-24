// The delivery worker secret (security fix,
// 20260924001100_delivery_outbox.sql's app_private.delivery_worker /
// check_worker_secret): both `claim_pending_dispatches` and
// `record_dispatch_outcome` now require this in addition to `auth.uid()`,
// so any signed-in identity alone can no longer read queued recipient
// addresses or suppress/delay delivery over the publishable-key RPC surface.
//
// `DELIVERY_WORKER_SECRET` is server-only (never `NEXT_PUBLIC_`, matching
// mailer-smtp.ts's DELIVERY_SMTP_*/DELIVERY_FROM_ADDRESS convention and
// ARCHITECTURE.md §6 rule 6 "secrets stay server-side") and is read ONLY
// inside this module — nothing else under src/delivery/ (or anywhere else)
// touches `process.env.DELIVERY_WORKER_SECRET` directly, verified by
// mailer.test.ts's import-boundary test. Wiring this getter's value into the
// claim/record RPC calls themselves is a later pass (this one only adds the
// getter for that pass to use) — see design.md Decision a and the security
// fix's own task notes.
//
// Same static-read convention as mailer-smtp.ts's checkEnv: Next.js only
// inlines NEXT_PUBLIC_* vars when referenced statically
// (`process.env.NEXT_PUBLIC_...`), and this codebase's convention (see
// src/stayover/supabase/env.ts and its env.test.ts regression guard) is to
// never read an env var through a bracketed, dynamically-computed key
// anywhere under src/ at all — this getter reads its var by a
// statically-written dotted name.

/**
 * The shared secret the app's own server-side delivery-retry code presents
 * to `claim_pending_dispatches`/`record_dispatch_outcome`. Throws if unset —
 * the owner configures it once per setup.md ("Delivery worker secret"
 * section): a random value in `DELIVERY_WORKER_SECRET` (env), whose sha256
 * hash (hex-encoded) is separately inserted into
 * `app_private.delivery_worker` via the Supabase SQL editor. The two must
 * match, or every claim/record call is refused with `not_worker`.
 */
export function deliveryWorkerSecret(): string {
  const value = process.env.DELIVERY_WORKER_SECRET;
  if (!value) {
    throw new Error("Missing required environment variable: DELIVERY_WORKER_SECRET");
  }
  return value;
}
