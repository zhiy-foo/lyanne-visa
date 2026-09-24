"use client";

import { useRouter } from "next/navigation";
import { Applications } from "@/ui/screens/Applications";
import type { ApplicationsProps } from "@/ui/types";

export function ApplicationsClient(props: Omit<ApplicationsProps, "onOpen" | "onNew">) {
  const router = useRouter();
  return (
    <Applications
      {...props}
      onOpen={(applicationId) => router.push(`/applications/${applicationId}`)}
      onNew={() => router.push("/applications/new")}
    />
  );
}
