"use client";

import { useRouter } from "next/navigation";
import { Overview } from "@/ui/screens/Overview";
import type { OverviewProps } from "@/ui/types";

// src/ui stays router-agnostic (Overview's onOpen is a plain callback, not a
// Promise) — this client wrapper is where Next's navigation lives, same
// split as src/app/dev/gallery/registry.tsx keeping app-level concerns out
// of src/ui.
export function OverviewClient(props: Omit<OverviewProps, "onOpen">) {
  const router = useRouter();
  return <Overview {...props} onOpen={(applicationId) => router.push(`/applications/${applicationId}`)} />;
}
