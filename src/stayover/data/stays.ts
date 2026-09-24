import "server-only";
import type {
  ApplicationDetailProps,
  DateRange,
  Move as UiMove,
  OverviewStay,
  Phase as UiPhase,
  Side,
  StaySummary,
} from "@/ui/types";
import { computeCan, type ApplicationState } from "../validateMove";
import { createClient } from "../supabase/server";

function assertNoError(...results: { error: unknown }[]) {
  for (const result of results) {
    if (result.error) {
      throw new Error(typeof result.error === "object" ? JSON.stringify(result.error) : String(result.error));
    }
  }
}

/** Maps the database's `status` ('rejected') to the UI's `Phase`
 * ('declined') — the one place this rename happens (ui-design-brief.md's
 * component/prop contract predates the database's naming). */
function toUiPhase(status: string): UiPhase {
  return status === "rejected" ? "declined" : (status as UiPhase);
}

function toUiSide(side: string | null): Side | undefined {
  return side === "parent" || side === "host" ? side : undefined;
}

type ApplicationRow = {
  application_id: string;
  child_id: string;
  child_name: string;
  place_id: string;
  place_name: string;
  place_time_zone: string;
  status: string;
  awaiting: string | null;
  agreed_start: string | null;
  agreed_end: string | null;
  open_start: string | null;
  open_end: string | null;
  open_side: string | null;
  revision: number;
  viewer_side: string | null;
  last_move_at: string;
};

async function loadMyApplications(): Promise<ApplicationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_applications");
  assertNoError({ error });
  return (data ?? []) as ApplicationRow[];
}

function displayDates(row: ApplicationRow): DateRange {
  if (row.agreed_start && row.agreed_end) return { start: row.agreed_start, end: row.agreed_end };
  if (row.open_start && row.open_end) return { start: row.open_start, end: row.open_end };
  return { start: row.last_move_at.slice(0, 10), end: row.last_move_at.slice(0, 10) };
}

function toStaySummary(row: ApplicationRow, viewerSide: Side): StaySummary {
  return {
    id: row.application_id,
    childName: row.child_name,
    placeName: row.place_name,
    dates: displayDates(row),
    phase: toUiPhase(row.status),
    awaiting: toUiSide(row.awaiting),
    viewerSide,
  };
}

/** Overview loader (task 5.3): every application the caller may see, mapped
 * to OverviewStay. Applications where the caller has no side (only possible
 * for the admin — who never lands on Overview per routing.ts) are dropped. */
export async function loadOverview(): Promise<OverviewStay[]> {
  const rows = await loadMyApplications();
  return rows
    .filter((row): row is ApplicationRow & { viewer_side: string } => row.viewer_side !== null)
    .map((row) => toStaySummary(row, row.viewer_side as Side));
}

/** Applications list loader (task 5.3): same rows, same mapping — the
 * screen itself groups them (categorizeStay in src/ui/stayStatus.ts). */
export async function loadApplications(): Promise<StaySummary[]> {
  return loadOverview();
}

type MoveRow = {
  move_id: string;
  kind: string;
  side: string;
  by_name: string;
  at: string;
  date_start: string | null;
  date_end: string | null;
  note: string | null;
};

function toUiMoveKind(kind: string): UiMove["kind"] {
  return kind === "reject" ? "decline" : (kind as UiMove["kind"]);
}

function toUiMove(row: MoveRow): UiMove {
  return {
    kind: toUiMoveKind(row.kind),
    side: row.side as Side,
    byName: row.by_name,
    at: row.at,
    dates: row.date_start && row.date_end ? { start: row.date_start, end: row.date_end } : undefined,
    note: row.note ?? undefined,
  };
}

export type ApplicationDetailData = Pick<
  ApplicationDetailProps,
  | "childName"
  | "placeName"
  | "placeTimeZone"
  | "viewerSide"
  | "phase"
  | "awaiting"
  | "agreed"
  | "proposed"
  | "history"
  | "can"
>;

/** Application detail loader (task 5.3): status/dates/history/`can`, per
 * §5's state table (mirrored client-side by validateMove.computeCan). */
export async function loadApplicationDetail(applicationId: string): Promise<ApplicationDetailData | null> {
  const supabase = await createClient();
  const [rows, movesRes] = await Promise.all([
    loadMyApplications(),
    supabase.rpc("application_moves", { p_application: applicationId }),
  ]);
  assertNoError(movesRes);

  const row = rows.find((r) => r.application_id === applicationId);
  if (!row || row.viewer_side === null) return null;

  const viewerSide = row.viewer_side as Side;
  const state: ApplicationState = {
    phase: toUiPhase(row.status),
    awaiting: toUiSide(row.awaiting),
    hostHasAnswered: ((movesRes.data ?? []) as MoveRow[]).some((m) => m.side === "host"),
  };

  return {
    childName: row.child_name,
    placeName: row.place_name,
    placeTimeZone: row.place_time_zone,
    viewerSide,
    phase: state.phase,
    awaiting: state.awaiting,
    agreed: row.agreed_start && row.agreed_end ? { start: row.agreed_start, end: row.agreed_end } : undefined,
    proposed: row.open_start && row.open_end ? { start: row.open_start, end: row.open_end } : undefined,
    history: ((movesRes.data ?? []) as MoveRow[]).map(toUiMove),
    can: computeCan(state, viewerSide),
  };
}

type ChildOption = { id: string; name: string };
type PlaceOption = { id: string; name: string };

/** PlanStay loader (task 5.3): the parent's own children and every home in
 * the directory, for the Select dropdowns. */
export async function loadPlanStayOptions(): Promise<{ children: ChildOption[]; places: PlaceOption[] }> {
  const supabase = await createClient();
  const [childrenRes, placesRes] = await Promise.all([
    supabase.from("child").select("id, name"),
    supabase.rpc("home_directory"),
  ]);
  assertNoError(childrenRes, placesRes);

  return {
    children: (childrenRes.data ?? []) as ChildOption[],
    places: ((placesRes.data ?? []) as { id: string; name: string; time_zone: string }[]).map((p) => ({
      id: p.id,
      name: p.name,
    })),
  };
}

type CapacityStatusRow = { night: string; agreed_count: number; at_capacity: boolean };

/** The pre-submit capacity read (design Decision 5) PlanStay's
 * `capacityWarning` prop is built from. */
export async function loadPlaceCapacityStatus(
  placeId: string,
  dates: DateRange,
): Promise<CapacityStatusRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_capacity_status", {
    p_place: placeId,
    p_date_start: dates.start,
    p_date_end: dates.end,
  });
  assertNoError({ error });
  return (data ?? []) as CapacityStatusRow[];
}
