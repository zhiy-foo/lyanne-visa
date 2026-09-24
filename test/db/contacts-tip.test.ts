import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asAnon, asUser, createTestDb, createUser } from "./harness";

/**
 * ui-design-brief.md §5 "Stage 4" contacts tip: `contacts_tip_dismissed()`
 * (read) and `dismiss_contacts_tip()` (write) —
 * 20260924001400_contacts_tip_dismissal.sql. Dismissal is per-account
 * (`member.contacts_tip_dismissed_at`), not per-browser; there is no target
 * member id parameter, so the write can only ever touch the caller's own row.
 */

interface Identity {
  userId: string;
  memberId: string;
}

async function insertMember(
  db: PGlite,
  email: string,
  name: string,
  status: "waiting" | "active" | "deactivated" = "active",
): Promise<Identity> {
  const userId = await createUser(db, email);
  const result = await db.query<{ id: string }>(
    `insert into member (user_id, name, role, status) values ($1, $2, 'parent', $3) returning id;`,
    [userId, name, status],
  );
  return { userId, memberId: result.rows[0].id };
}

async function contactsTipDismissed(db: PGlite, userId: string): Promise<boolean> {
  const result = await asUser(db, userId, (tx) =>
    tx.query<{ contacts_tip_dismissed: boolean }>(`select contacts_tip_dismissed();`),
  );
  return result.rows[0].contacts_tip_dismissed;
}

describe("contacts tip dismissal", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await db.close();
  });

  it("is false before dismissal", async () => {
    const alice = await insertMember(db, "alice@example.com", "Alice");
    expect(await contactsTipDismissed(db, alice.userId)).toBe(false);
  });

  it("dismiss_contacts_tip sets the caller's own row", async () => {
    const alice = await insertMember(db, "alice@example.com", "Alice");

    await asUser(db, alice.userId, (tx) => tx.query(`select dismiss_contacts_tip();`));

    expect(await contactsTipDismissed(db, alice.userId)).toBe(true);
    const stored = await db.query<{ contacts_tip_dismissed_at: Date | null }>(
      `select contacts_tip_dismissed_at from member where id = $1;`,
      [alice.memberId],
    );
    expect(stored.rows[0].contacts_tip_dismissed_at).not.toBeNull();
  });

  it("dismissing does not affect another member's row", async () => {
    const alice = await insertMember(db, "alice@example.com", "Alice");
    const bob = await insertMember(db, "bob@example.com", "Bob");

    await asUser(db, alice.userId, (tx) => tx.query(`select dismiss_contacts_tip();`));

    expect(await contactsTipDismissed(db, alice.userId)).toBe(true);
    expect(await contactsTipDismissed(db, bob.userId)).toBe(false);
  });

  it("dismiss_contacts_tip by a signed-out caller is refused (no execute grant to anon)", async () => {
    await expect(asAnon(db, (tx) => tx.query(`select dismiss_contacts_tip();`))).rejects.toThrow();
  });

  it("dismiss_contacts_tip by a waiting (not yet active) member is refused (not_active)", async () => {
    const waiting = await insertMember(db, "waiting@example.com", "Waiting", "waiting");
    await expect(
      asUser(db, waiting.userId, (tx) => tx.query(`select dismiss_contacts_tip();`)),
    ).rejects.toThrow("not_active");
  });

  it("contacts_tip_dismissed by a signed-out caller is refused (no execute grant to anon)", async () => {
    await expect(asAnon(db, (tx) => tx.query(`select contacts_tip_dismissed();`))).rejects.toThrow();
  });

  it("contacts_tip_dismissed is false for a deactivated member, even after a prior dismissal", async () => {
    const member = await insertMember(db, "deactivated@example.com", "Was Active");
    await asUser(db, member.userId, (tx) => tx.query(`select dismiss_contacts_tip();`));
    await db.query(`update member set status = 'deactivated' where id = $1;`, [member.memberId]);

    expect(await contactsTipDismissed(db, member.userId)).toBe(false);
  });
});
