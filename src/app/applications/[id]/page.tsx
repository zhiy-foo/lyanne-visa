import { notFound } from "next/navigation";
import { AppShell } from "@/ui/AppShell";
import { requireAccountForPath } from "@/stayover/route-guard";
import { signOut } from "@/stayover/actions/auth";
import { loadApplicationDetail } from "@/stayover/data/stays";
import { navFor } from "@/stayover/nav";
import { ApplicationDetailClient } from "./ApplicationDetailClient";

type PageProps = { params: Promise<{ id: string }> };

/** spec "Application detail shows status, dates and history plainly". A
 * signed-in caller with no side on this application (uninvolved member) or
 * an unknown id gets the same 404 — `loadApplicationDetail` returns null
 * for both, since `my_applications()` (RLS + its own filter) already never
 * returns rows the caller may not see. */
export default async function ApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const account = await requireAccountForPath(`/applications/${id}`);
  const role = account.role ?? "parent";
  const detail = await loadApplicationDetail(id);
  if (!detail) notFound();

  return (
    <AppShell user={{ name: account.name ?? "" }} nav={navFor(role, "/applications")} onSignOut={signOut}>
      <ApplicationDetailClient applicationId={id} {...detail} />
    </AppShell>
  );
}
