import "server-only";
import type { AdminProps } from "@/ui/types";
import { createClient } from "../supabase/server";

type AdminAccountRow = {
  member_id: string;
  name: string;
  email: string;
  role: "parent" | "host";
  status: "waiting" | "active" | "deactivated";
  status_at: string;
  created_at: string;
  child_ids: string[];
  place_ids: string[];
};
type ChildRow = { id: string; name: string };
type GuardianRow = { member_id: string; child_id: string };
type PlaceRow = { id: string; name: string; address: string | null; time_zone: string };
type PlaceHostRow = { member_id: string; place_id: string };

function assertNoError(...results: { error: unknown }[]) {
  for (const result of results) {
    if (result.error) {
      throw new Error(typeof result.error === "object" ? JSON.stringify(result.error) : String(result.error));
    }
  }
}

/** Everything the /admin page needs (account-access spec "The admin
 * account"; children-and-homes spec "Admin can correct children, homes and
 * links"). */
export async function loadAdminData(): Promise<
  Pick<AdminProps, "accounts" | "children" | "homes" | "joinCodeSet">
> {
  const supabase = await createClient();

  const [accountsRes, childrenRes, guardiansRes, placesRes, hostsRes, joinCodeRes] = await Promise.all([
    supabase.rpc("admin_accounts"),
    supabase.from("child").select("id, name"),
    supabase.from("guardian").select("member_id, child_id"),
    supabase.from("place").select("id, name, address, time_zone"),
    supabase.from("place_host").select("member_id, place_id"),
    supabase.rpc("join_code_is_set"),
  ]);
  assertNoError(accountsRes, childrenRes, guardiansRes, placesRes, hostsRes, joinCodeRes);

  const accounts = ((accountsRes.data ?? []) as AdminAccountRow[]).map((row) => ({
    id: row.member_id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    registeredAt: row.created_at,
    childIds: row.child_ids ?? [],
    homeIds: row.place_ids ?? [],
  }));

  const guardians = (guardiansRes.data ?? []) as GuardianRow[];
  const children = ((childrenRes.data ?? []) as ChildRow[]).map((child) => ({
    id: child.id,
    name: child.name,
    parentIds: guardians.filter((g) => g.child_id === child.id).map((g) => g.member_id),
  }));

  const placeHosts = (hostsRes.data ?? []) as PlaceHostRow[];
  const homes = ((placesRes.data ?? []) as PlaceRow[]).map((place) => ({
    id: place.id,
    name: place.name,
    address: place.address ?? undefined,
    timeZone: place.time_zone,
    hostIds: placeHosts.filter((h) => h.place_id === place.id).map((h) => h.member_id),
  }));

  return {
    accounts,
    children,
    homes,
    joinCodeSet: Boolean(joinCodeRes.data),
  };
}
