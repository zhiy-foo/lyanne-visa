import { redirect } from "next/navigation";
import { requireAccountForPath } from "@/stayover/route-guard";

// /admin is a landing spot only — the admin area itself is split into
// /admin/accounts, /admin/children and /admin/homes (task 4.4).
export default async function AdminPage() {
  await requireAccountForPath("/admin");
  redirect("/admin/accounts");
}
