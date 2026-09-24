"use client";

import { useRouter } from "next/navigation";
import { ApplicationDetail } from "@/ui/screens/ApplicationDetail";
import type { ApplicationDetailProps, DateRange } from "@/ui/types";
import { acceptMove, cancelMove, declineMove, deleteApplication, proposeMove } from "@/stayover/actions/stays";

type Props = Omit<
  ApplicationDetailProps,
  "onAccept" | "onDecline" | "onPropose" | "onCancel" | "onDelete"
> & { applicationId: string };

export function ApplicationDetailClient({ applicationId, ...rest }: Props) {
  const router = useRouter();

  async function onAccept() {
    const result = await acceptMove(applicationId);
    if (result.ok) router.refresh();
    return result;
  }
  async function onDecline(note?: string) {
    const result = await declineMove(applicationId, note);
    if (result.ok) router.refresh();
    return result;
  }
  async function onPropose(dates: DateRange, note?: string) {
    const result = await proposeMove(applicationId, dates, note);
    if (result.ok) router.refresh();
    return result;
  }
  async function onCancel(note?: string) {
    const result = await cancelMove(applicationId, note);
    if (result.ok) router.refresh();
    return result;
  }
  async function onDelete() {
    const result = await deleteApplication(applicationId);
    if (result.ok) router.push("/applications");
    return result;
  }

  const props: ApplicationDetailProps = { ...rest, onAccept, onDecline, onPropose, onCancel, onDelete };
  return <ApplicationDetail {...props} />;
}
