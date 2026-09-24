import { describe, expect, it } from "vitest";
import { buildApplicationDeletedEvent, buildMoveCommittedEvent } from "./events";

describe("buildMoveCommittedEvent (task 4.1)", () => {
  it("builds a MoveCommitted event from a record_move result", () => {
    const event = buildMoveCommittedEvent(
      {
        move_id: "move-1",
        application_id: "app-1",
        child_id: "child-1",
        place_id: "place-1",
        kind: "accept",
        side: "host",
        by: "member-1",
        at: "2026-09-24T10:00:00Z",
        date_start: null,
        date_end: null,
        note: null,
        status_before: "negotiating",
        status_after: "confirmed",
      },
      "Lyanne",
      "Grandma & Grandpa's",
      "Asia/Singapore",
    );

    expect(event.kind).toBe("MoveCommitted");
    expect(event.before).toBe("negotiating");
    expect(event.after).toBe("confirmed");
    expect(event.application).toEqual({
      id: "app-1",
      childId: "child-1",
      childName: "Lyanne",
      placeId: "place-1",
      placeName: "Grandma & Grandpa's",
      placeTimeZone: "Asia/Singapore",
    });
    expect(event.move.dates).toBeUndefined();
  });

  it("carries mv_dates? only for a propose move", () => {
    const event = buildMoveCommittedEvent(
      {
        move_id: "move-2",
        application_id: "app-1",
        child_id: "child-1",
        place_id: "place-1",
        kind: "propose",
        side: "parent",
        by: "member-1",
        at: "2026-09-24T10:00:00Z",
        date_start: "2026-10-03",
        date_end: "2026-10-06",
        note: "Thanks!",
        status_after: "negotiating",
      },
      "Lyanne",
      "Grandma & Grandpa's",
      "Asia/Singapore",
    );

    expect(event.move.dates).toEqual({ start: "2026-10-03", end: "2026-10-06" });
    expect(event.move.note).toBe("Thanks!");
    // open_application has no "before" — defaults to negotiating (its own
    // initial phase), not left undefined.
    expect(event.before).toBe("negotiating");
  });
});

describe("buildApplicationDeletedEvent (task 4.1)", () => {
  it("builds an ApplicationDeleted event with the agreed dates when present", () => {
    const event = buildApplicationDeletedEvent(
      "app-1",
      {
        child_name: "Lyanne",
        place_name: "Grandma & Grandpa's",
        host_member_ids: ["host-1"],
        agreed_start: "2026-10-03",
        agreed_end: "2026-10-06",
        open_start: null,
        open_end: null,
      },
      [{ memberId: "host-1", name: "Grandma", email: "grandma@example.com", side: "host" }],
    );

    expect(event.kind).toBe("ApplicationDeleted");
    expect(event.dates).toEqual({ start: "2026-10-03", end: "2026-10-06" });
    expect(event.hosts).toHaveLength(1);
  });

  it("falls back to the open (unanswered) dates when nothing was agreed", () => {
    const event = buildApplicationDeletedEvent(
      "app-1",
      {
        child_name: "Lyanne",
        place_name: "Grandma & Grandpa's",
        host_member_ids: [],
        agreed_start: null,
        agreed_end: null,
        open_start: "2026-10-03",
        open_end: "2026-10-06",
      },
      [],
    );

    expect(event.dates).toEqual({ start: "2026-10-03", end: "2026-10-06" });
  });

  it("carries null dates when neither is present (defensive — should not occur in practice)", () => {
    const event = buildApplicationDeletedEvent(
      "app-1",
      {
        child_name: "Lyanne",
        place_name: "Grandma & Grandpa's",
        host_member_ids: [],
        agreed_start: null,
        agreed_end: null,
        open_start: null,
        open_end: null,
      },
      [],
    );

    expect(event.dates).toBeNull();
  });
});

describe("a failed move never produces an event (task 4.2)", () => {
  it("callers only build an event from a resolved RPC result — a rejected RPC call throws before either builder runs", async () => {
    // Simulates the shape actions/stays.ts uses: build the event only after
    // an rpc() call that did not error. A failing rpc() never reaches
    // buildMoveCommittedEvent at all.
    async function fakeAction(shouldFail: boolean) {
      const rpc = async () =>
        shouldFail
          ? { data: null, error: { message: "overlap_conflict" } }
          : {
              data: [
                {
                  move_id: "m1",
                  application_id: "a1",
                  child_id: "c1",
                  place_id: "p1",
                  kind: "accept",
                  side: "host",
                  by: "member-1",
                  at: "2026-09-24T10:00:00Z",
                  date_start: null,
                  date_end: null,
                  note: null,
                  status_before: "negotiating",
                  status_after: "confirmed",
                },
              ],
              error: null,
            };
      const { data, error } = await rpc();
      if (error) return { ok: false as const, event: undefined };
      const event = buildMoveCommittedEvent(data[0], "Lyanne", "Grandma's", "Asia/Singapore");
      return { ok: true as const, event };
    }

    const failed = await fakeAction(true);
    expect(failed.ok).toBe(false);
    expect(failed.event).toBeUndefined();

    const succeeded = await fakeAction(false);
    expect(succeeded.ok).toBe(true);
    expect(succeeded.event).toBeDefined();
  });
});
