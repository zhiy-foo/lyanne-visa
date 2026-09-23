import "server-only";
import type { HostHomeProps, ParentHomeProps } from "@/ui/types";
import { createClient } from "../supabase/server";

type ChildRow = { id: string; name: string };
type GuardianRow = { member_id: string; child_id: string };
type MemberRow = { id: string; name: string };
type EmailRow = { member_id: string; email: string };
type PlaceRow = { id: string; name: string; address: string | null; time_zone: string };
type PlaceHostRow = { member_id: string; place_id: string };
type DirectoryRow = { id: string; name: string; time_zone: string };

function assertNoError(...results: { error: unknown }[]) {
  for (const result of results) {
    if (result.error) {
      throw new Error(typeof result.error === "object" ? JSON.stringify(result.error) : String(result.error));
    }
  }
}

/** Data for /home when the signed-in caller is an active parent: their own
 * children with co-parents (children-and-homes spec "Each person sees only
 * what they are connected to"), plus the address-free home directory every
 * active member sees. */
export async function loadParentHome(): Promise<Pick<ParentHomeProps, "children" | "homes">> {
  const supabase = await createClient();

  const [childrenRes, guardiansRes, membersRes, emailsRes, directoryRes] = await Promise.all([
    supabase.from("child").select("id, name"),
    supabase.from("guardian").select("member_id, child_id"),
    supabase.from("member").select("id, name"),
    supabase.rpc("member_emails"),
    supabase.rpc("home_directory"),
  ]);
  assertNoError(childrenRes, guardiansRes, membersRes, emailsRes, directoryRes);

  const guardians = (guardiansRes.data ?? []) as GuardianRow[];
  const nameByMember = new Map(((membersRes.data ?? []) as MemberRow[]).map((m) => [m.id, m.name]));
  const emailByMember = new Map(((emailsRes.data ?? []) as EmailRow[]).map((e) => [e.member_id, e.email]));

  const children = ((childrenRes.data ?? []) as ChildRow[]).map((child) => ({
    id: child.id,
    name: child.name,
    parents: guardians
      .filter((g) => g.child_id === child.id)
      .map((g) => ({
        id: g.member_id,
        name: nameByMember.get(g.member_id) ?? "",
        email: emailByMember.get(g.member_id) ?? "",
      })),
  }));

  const homes = ((directoryRes.data ?? []) as DirectoryRow[]).map((place) => ({
    id: place.id,
    name: place.name,
    timeZone: place.time_zone,
  }));

  return { children, homes };
}

/** Data for /home when the signed-in caller is an active host: their own
 * homes, with address, and those homes' co-hosts. */
export async function loadHostHome(): Promise<Pick<HostHomeProps, "homes">> {
  const supabase = await createClient();

  const [placesRes, hostsRes, membersRes, emailsRes] = await Promise.all([
    supabase.from("place").select("id, name, address, time_zone"),
    supabase.from("place_host").select("member_id, place_id"),
    supabase.from("member").select("id, name"),
    supabase.rpc("member_emails"),
  ]);
  assertNoError(placesRes, hostsRes, membersRes, emailsRes);

  const placeHosts = (hostsRes.data ?? []) as PlaceHostRow[];
  const nameByMember = new Map(((membersRes.data ?? []) as MemberRow[]).map((m) => [m.id, m.name]));
  const emailByMember = new Map(((emailsRes.data ?? []) as EmailRow[]).map((e) => [e.member_id, e.email]));

  const homes = ((placesRes.data ?? []) as PlaceRow[]).map((place) => ({
    id: place.id,
    name: place.name,
    address: place.address ?? undefined,
    timeZone: place.time_zone,
    hosts: placeHosts
      .filter((h) => h.place_id === place.id)
      .map((h) => ({
        id: h.member_id,
        name: nameByMember.get(h.member_id) ?? "",
        email: emailByMember.get(h.member_id) ?? "",
      })),
  }));

  return { homes };
}
