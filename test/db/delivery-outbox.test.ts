import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asAnon, asUser, createTestDb, createUser } from "./harness";

/**
 * Tasks 1.1, 1.2: the `dispatch` table and its two functions,
 * `claim_pending_dispatches`/`record_dispatch_outcome`
 * (20260924001100_delivery_outbox.sql).
 *
 * Note on concurrency (mirrors stays-functions.test.ts's and
 * stays-schema.test.ts's own note): PGlite serves exactly one connection, so
 * two callers racing to claim the same row with `for update skip locked`
 * cannot actually be exercised concurrently here — there is no second
 * backend to race against. What IS verified here: the WHERE clause's
 * eligibility logic (a pending, never-claimed row is claimable; a row
 * claimed within the stale window is not reclaimed by a second call; a row
 * claimed past the stale window is reclaimed; a row still inside its own
 * backoff window after a failed attempt is not reclaimed; `sent`/`failed`
 * rows are never claimed at all) and that a claimed row's id is excluded
 * from a second claim call happening after the first (proving the same
 * `dispatch` row is not returned twice to two sequential batches while still
 * fresh-claimed) — everything short of true concurrent-backend locking. That
 * `for update skip locked` actually prevents two *simultaneous* backends
 * from double-claiming is a property of Postgres's row-locking, not
 * something PGlite can single-connection-test; it is deferred to hosted
 * Supabase, the same posture as record_move's overlap/capacity locks.
 */

interface DispatchRow {
  id: string;
  member_id: string | null;
  application_id: string | null;
  to_email: string;
  kind: string;
  revision: number;
  status: string;
  attempts: number;
  last_error: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
}

// The worker secret used across most tests below (security fix: both
// claim_pending_dispatches and record_dispatch_outcome now require this in
// addition to auth.uid() — see 20260924001100_delivery_outbox.sql's
// app_private.delivery_worker / check_worker_secret). Tests configure it
// explicitly per-describe rather than in the top-level beforeEach so the
// "no secret configured" and "wrong secret" cases can be exercised too.
const WORKER_SECRET = "test-worker-secret-do-not-use-in-prod";

describe("delivery outbox (dispatch, claim_pending_dispatches, record_dispatch_outcome)", () => {
  let db: PGlite;
  let userId: string;

  beforeEach(async () => {
    db = await createTestDb();
    userId = await createUser(db, "p1@example.com");
    await db.query(
      `insert into member (user_id, name, role, status) values ($1, 'P1', 'parent', 'active');`,
      [userId],
    );
  });

  afterEach(async () => {
    await db.close();
  });

  /** Configures the single app_private.delivery_worker row's secret_hash. */
  async function setWorkerSecret(secret: string): Promise<void> {
    await db.query(
      `insert into app_private.delivery_worker (secret_hash) values (encode(extensions.digest($1, 'sha256'), 'hex'));`,
      [secret],
    );
  }

  async function insertDispatch(overrides: Partial<{
    kind: string;
    to_email: string;
    status: string;
    attempts: number;
    claimed_at: string | null;
    updated_at: string | null;
    last_error: string | null;
  }> = {}): Promise<string> {
    const {
      kind = "notice",
      to_email = "grandma@example.com",
      status = "pending",
      attempts = 0,
      claimed_at = null,
      updated_at = null,
      last_error = null,
    } = overrides;
    const result = await db.query<{ id: string }>(
      `insert into dispatch (kind, to_email, status, attempts, claimed_at, last_error, updated_at)
       values ($1, $2, $3, $4, $5, $6, coalesce($7, now()))
       returning id;`,
      [kind, to_email, status, attempts, claimed_at, last_error, updated_at],
    );
    return result.rows[0].id;
  }

  async function claim(
    secret: string,
    limit: number = 20,
    staleAfter: string = "5 minutes",
    callerId: string = userId,
  ): Promise<DispatchRow[]> {
    const result = await asUser(db, callerId, (tx) =>
      tx.query<DispatchRow>(
        `select * from claim_pending_dispatches($1, $2, $3::interval);`,
        [secret, limit, staleAfter],
      ),
    );
    return result.rows;
  }

  async function recordOutcome(
    secret: string,
    dispatchId: string,
    status: "sent" | "failed",
    error: string | null = null,
    callerId: string = userId,
  ): Promise<DispatchRow> {
    const result = await asUser(db, callerId, (tx) =>
      tx.query<DispatchRow>(
        `select * from record_dispatch_outcome($1, $2, $3, $4);`,
        [secret, dispatchId, status, error],
      ),
    );
    return result.rows[0];
  }

  // -- table constraints --------------------------------------------------

  describe("dispatch table constraints", () => {
    it("rejects an unknown kind", async () => {
      await expect(
        db.query(`insert into dispatch (kind, to_email) values ('bogus', 'a@example.com');`),
      ).rejects.toThrow();
    });

    it("rejects an unknown status", async () => {
      await expect(
        db.query(`insert into dispatch (kind, to_email, status) values ('notice', 'a@example.com', 'bogus');`),
      ).rejects.toThrow();
    });

    it("rejects a non-lowercase to_email", async () => {
      await expect(
        db.query(`insert into dispatch (kind, to_email) values ('notice', 'A@Example.com');`),
      ).rejects.toThrow();
    });

    it("rejects status = failed unless attempts = 4", async () => {
      await expect(
        db.query(
          `insert into dispatch (kind, to_email, status, attempts, last_error) values ('notice', 'a@example.com', 'failed', 2, 'boom');`,
        ),
      ).rejects.toThrow();
    });

    it("rejects a failed row with no last_error, and a non-failed row with one", async () => {
      await expect(
        db.query(
          `insert into dispatch (kind, to_email, status, attempts) values ('notice', 'a@example.com', 'failed', 4);`,
        ),
      ).rejects.toThrow();
      await expect(
        db.query(
          `insert into dispatch (kind, to_email, status, last_error) values ('notice', 'a@example.com', 'pending', 'boom');`,
        ),
      ).rejects.toThrow();
    });

    it("accepts a well-formed pending row with nullable member_id/application_id", async () => {
      const id = await insertDispatch();
      const row = await db.query<DispatchRow>(`select * from dispatch where id = $1;`, [id]);
      expect(row.rows[0].member_id).toBeNull();
      expect(row.rows[0].application_id).toBeNull();
      expect(row.rows[0].status).toBe("pending");
      expect(row.rows[0].attempts).toBe(0);
    });
  });

  // -- direct table access is refused ---------------------------------------

  describe("direct table access", () => {
    it("authenticated cannot SELECT dispatch directly", async () => {
      await insertDispatch();
      await expect(
        asUser(db, userId, (tx) => tx.query(`select * from dispatch;`)),
      ).rejects.toThrow();
    });

    it("authenticated cannot INSERT into dispatch directly", async () => {
      await expect(
        asUser(db, userId, (tx) =>
          tx.query(`insert into dispatch (kind, to_email) values ('notice', 'a@example.com');`),
        ),
      ).rejects.toThrow();
    });

    it("anon cannot SELECT dispatch directly", async () => {
      await insertDispatch();
      await expect(asAnon(db, (tx) => tx.query(`select * from dispatch;`))).rejects.toThrow();
    });
  });

  // -- claim_pending_dispatches ---------------------------------------------

  describe("claim_pending_dispatches", () => {
    beforeEach(async () => {
      await setWorkerSecret(WORKER_SECRET);
    });

    it("refuses a signed-out caller (even with the right secret)", async () => {
      await expect(
        asAnon(db, (tx) => tx.query(`select * from claim_pending_dispatches($1);`, [WORKER_SECRET])),
      ).rejects.toThrow();
    });

    it("claims a never-attempted pending row", async () => {
      const id = await insertDispatch();
      const claimed = await claim(WORKER_SECRET);
      expect(claimed.map((r) => r.id)).toContain(id);
      expect(claimed[0].claimed_at).not.toBeNull();
    });

    it("does not claim a sent or failed row", async () => {
      await insertDispatch({ status: "sent", attempts: 1 });
      await insertDispatch({ status: "failed", attempts: 4, last_error: "boom" });
      const claimed = await claim(WORKER_SECRET);
      expect(claimed).toHaveLength(0);
    });

    it("does not re-claim a row already claimed within the stale window", async () => {
      await insertDispatch({ claimed_at: new Date().toISOString() });
      const claimed = await claim(WORKER_SECRET, 20, "5 minutes");
      expect(claimed).toHaveLength(0);
    });

    it("re-claims a row claimed past the stale window (cut-short attempt)", async () => {
      const staleClaimedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const id = await insertDispatch({ claimed_at: staleClaimedAt });
      const claimed = await claim(WORKER_SECRET, 20, "5 minutes");
      expect(claimed.map((r) => r.id)).toContain(id);
    });

    it("does not claim a pending row still inside its own backoff window after a failed attempt", async () => {
      // attempts = 2 -> backoff = 4 minutes; updated_at 1 minute ago is still inside it.
      const recentUpdatedAt = new Date(Date.now() - 60 * 1000).toISOString();
      await insertDispatch({ attempts: 2, updated_at: recentUpdatedAt });
      const claimed = await claim(WORKER_SECRET);
      expect(claimed).toHaveLength(0);
    });

    it("claims a pending row once its backoff window has elapsed", async () => {
      // attempts = 1 -> backoff = 2 minutes; updated_at 5 minutes ago has elapsed it.
      const oldUpdatedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const id = await insertDispatch({ attempts: 1, updated_at: oldUpdatedAt });
      const claimed = await claim(WORKER_SECRET);
      expect(claimed.map((r) => r.id)).toContain(id);
    });

    it("respects the limit and orders oldest-created first", async () => {
      const first = await insertDispatch({ to_email: "a@example.com" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await insertDispatch({ to_email: "b@example.com" });
      const claimed = await claim(WORKER_SECRET, 1);
      expect(claimed).toHaveLength(1);
      expect(claimed[0].id).toBe(first);
    });

    it("a second call does not re-claim a row a first call just freshly claimed", async () => {
      const id = await insertDispatch();
      const first = await claim(WORKER_SECRET);
      expect(first.map((r) => r.id)).toContain(id);
      const second = await claim(WORKER_SECRET);
      expect(second.map((r) => r.id)).not.toContain(id);
    });

    it("refuses a wrong secret", async () => {
      await insertDispatch();
      await expect(claim("wrong-secret")).rejects.toThrow(/not_worker/);
    });

    it("refuses a wrong secret even for a caller with no member row", async () => {
      const strangerId = await createUser(db, "stranger@example.com");
      await insertDispatch();
      await expect(claim("wrong-secret", 20, "5 minutes", strangerId)).rejects.toThrow(/not_worker/);
    });
  });

  // -- record_dispatch_outcome ------------------------------------------------

  describe("record_dispatch_outcome", () => {
    beforeEach(async () => {
      await setWorkerSecret(WORKER_SECRET);
    });

    it("refuses a signed-out caller (even with the right secret)", async () => {
      const id = await insertDispatch();
      await expect(
        asAnon(db, (tx) =>
          tx.query(`select * from record_dispatch_outcome($1, $2, 'sent');`, [WORKER_SECRET, id]),
        ),
      ).rejects.toThrow();
    });

    it("refuses an unknown status", async () => {
      const id = await insertDispatch();
      await expect(recordOutcome(WORKER_SECRET, id, "bogus" as "sent")).rejects.toThrow();
    });

    it("raises not_found for an unknown dispatch id", async () => {
      await expect(
        asUser(db, userId, (tx) =>
          tx.query(`select * from record_dispatch_outcome($1, '00000000-0000-0000-0000-000000000000', 'sent');`, [
            WORKER_SECRET,
          ]),
        ),
      ).rejects.toThrow();
    });

    it("refuses a wrong secret", async () => {
      const id = await insertDispatch();
      await expect(recordOutcome("wrong-secret", id, "sent")).rejects.toThrow(/not_worker/);
    });

    it("refuses a wrong secret even for a caller with no member row", async () => {
      const strangerId = await createUser(db, "stranger@example.com");
      const id = await insertDispatch();
      await expect(
        recordOutcome("wrong-secret", id, "sent", null, strangerId),
      ).rejects.toThrow(/not_worker/);
    });

    it("a successful send sets status sent, attempts incremented, no error", async () => {
      const id = await insertDispatch();
      const row = await recordOutcome(WORKER_SECRET, id, "sent");
      expect(row.status).toBe("sent");
      expect(row.attempts).toBe(1);
      expect(row.last_error).toBeNull();
      expect(row.claimed_at).toBeNull();
    });

    it("increments attempts and stays pending on the first three failures", async () => {
      const id = await insertDispatch();
      let row = await recordOutcome(WORKER_SECRET, id, "failed", "smtp down");
      expect(row.status).toBe("pending");
      expect(row.attempts).toBe(1);
      expect(row.last_error).toBeNull(); // not FAILED yet, so no error kept

      row = await recordOutcome(WORKER_SECRET, id, "failed", "smtp down again");
      expect(row.status).toBe("pending");
      expect(row.attempts).toBe(2);

      row = await recordOutcome(WORKER_SECRET, id, "failed", "smtp down a third time");
      expect(row.status).toBe("pending");
      expect(row.attempts).toBe(3);
    });

    it("reaches failed with the last error only at the 4th failed attempt", async () => {
      const id = await insertDispatch();
      await recordOutcome(WORKER_SECRET, id, "failed", "1");
      await recordOutcome(WORKER_SECRET, id, "failed", "2");
      await recordOutcome(WORKER_SECRET, id, "failed", "3");
      const row = await recordOutcome(WORKER_SECRET, id, "failed", "final failure");
      expect(row.status).toBe("failed");
      expect(row.attempts).toBe(4);
      expect(row.last_error).toBe("final failure");
    });

    it("is idempotent against an already-terminal row (sent)", async () => {
      const id = await insertDispatch();
      await recordOutcome(WORKER_SECRET, id, "sent");
      const row = await recordOutcome(WORKER_SECRET, id, "sent");
      expect(row.status).toBe("sent");
      expect(row.attempts).toBe(1); // did not increment a second time
    });

    it("is idempotent against an already-terminal row (failed)", async () => {
      const id = await insertDispatch();
      await recordOutcome(WORKER_SECRET, id, "failed", "1");
      await recordOutcome(WORKER_SECRET, id, "failed", "2");
      await recordOutcome(WORKER_SECRET, id, "failed", "3");
      await recordOutcome(WORKER_SECRET, id, "failed", "4");
      const row = await recordOutcome(WORKER_SECRET, id, "failed", "5 — should be ignored");
      expect(row.status).toBe("failed");
      expect(row.attempts).toBe(4);
      expect(row.last_error).toBe("4");
    });

    it("clears claimed_at when going back to pending so it can be reclaimed later", async () => {
      const id = await insertDispatch({ claimed_at: new Date().toISOString() });
      const row = await recordOutcome(WORKER_SECRET, id, "failed", "boom");
      expect(row.status).toBe("pending");
      expect(row.claimed_at).toBeNull();
    });
  });

  // -- worker secret required (security fix) ---------------------------------
  // Uses the outer beforeEach's fresh db, which has no app_private.delivery_worker
  // row at all (setWorkerSecret is never called in this describe), matching a
  // freshly-migrated database on which the owner has not yet run setup.md's
  // one-time "configure the delivery worker secret" step.

  describe("worker secret required, none configured yet", () => {
    it("claim_pending_dispatches refuses even a plausible-looking secret", async () => {
      await insertDispatch();
      await expect(claim(WORKER_SECRET)).rejects.toThrow(/not_worker/);
    });

    it("record_dispatch_outcome refuses even a plausible-looking secret", async () => {
      const id = await insertDispatch();
      await expect(recordOutcome(WORKER_SECRET, id, "sent")).rejects.toThrow(/not_worker/);
    });
  });

  describe("app_private.delivery_worker is a singleton", () => {
    it("a second insert fails (only one worker secret can ever be configured)", async () => {
      await setWorkerSecret(WORKER_SECRET);
      await expect(setWorkerSecret("another-secret")).rejects.toThrow();
    });

    it("rotation via UPDATE ... WHERE true (setup.md's documented step) replaces the hash", async () => {
      await setWorkerSecret(WORKER_SECRET);
      const beforeRotation = await insertDispatch({ to_email: "before@example.com" });
      // Old secret still works before rotation.
      const claimedBefore = await claim(WORKER_SECRET);
      expect(claimedBefore.map((r) => r.id)).toContain(beforeRotation);

      await db.query(
        `update app_private.delivery_worker set secret_hash = encode(extensions.digest($1, 'sha256'), 'hex') where true;`,
        ["rotated-secret"],
      );

      const afterRotation = await insertDispatch({ to_email: "after@example.com" });

      // Old secret no longer works against the row queued after rotation.
      await expect(claim(WORKER_SECRET)).rejects.toThrow(/not_worker/);
      // The new secret does.
      const claimedAfter = await claim("rotated-secret");
      expect(claimedAfter.map((r) => r.id)).toContain(afterRotation);
    });
  });

  // -- application_id set null after a hard delete (design Decision 1) -----

  describe("application_id survives an application hard delete", () => {
    it("is set null when the referenced application is deleted", async () => {
      const child = await db.query<{ id: string }>(
        `insert into child (name, created_by) values ('C1', (select id from member limit 1)) returning id;`,
      );
      const place = await db.query<{ id: string }>(
        `insert into place (name, time_zone, created_by) values ('Home', 'Asia/Singapore', (select id from member limit 1)) returning id;`,
      );
      const app = await db.query<{ id: string }>(
        `insert into application (child_id, place_id, created_by) values ($1, $2, (select id from member limit 1)) returning id;`,
        [child.rows[0].id, place.rows[0].id],
      );
      const dispatchId = await db.query<{ id: string }>(
        `insert into dispatch (kind, to_email, application_id) values ('notice', 'a@example.com', $1) returning id;`,
        [app.rows[0].id],
      );

      await db.query(`delete from application where id = $1;`, [app.rows[0].id]);

      const row = await db.query<{ application_id: string | null }>(
        `select application_id from dispatch where id = $1;`,
        [dispatchId.rows[0].id],
      );
      expect(row.rows[0].application_id).toBeNull();
    });
  });
});
