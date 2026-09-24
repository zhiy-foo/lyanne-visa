"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlanStay } from "@/ui/screens/PlanStay";
import type { ActionResult, DateRange, PlanStayProps } from "@/ui/types";
import { checkCapacityWarning, openApplication } from "@/stayover/actions/stays";

type Props = Pick<PlanStayProps, "children" | "places">;

/** PlanStayProps.capacityWarning is a synchronous read, but the capacity
 * check is a server action. PlanStay calls onPlaceOrDatesChange from an
 * effect (never during render — calling a server action during render
 * updates the Router mid-render); this wrapper fetches the warning there,
 * caches it, and capacityWarning reads the cache on the next render. The
 * warning is advisory (design Decision 5), so a brief lag is harmless. */
export function PlanStayClient({ children, places }: Props) {
  const router = useRouter();
  const [cache, setCache] = useState<Record<string, string | undefined>>({});
  const pending = useRef<Set<string>>(new Set());

  const capacityWarning = useCallback(
    (placeId: string, dates: DateRange) => cache[`${placeId}|${dates.start}|${dates.end}`],
    [cache],
  );

  const onPlaceOrDatesChange = useCallback(
    (placeId: string, dates: DateRange) => {
      const key = `${placeId}|${dates.start}|${dates.end}`;
      if (pending.current.has(key)) return;
      pending.current.add(key);
      const placeName = places.find((p) => p.id === placeId)?.name ?? "";
      checkCapacityWarning(placeId, placeName, dates)
        .then((message) => setCache((current) => ({ ...current, [key]: message })))
        .catch(() => setCache((current) => ({ ...current, [key]: undefined })));
    },
    [places],
  );

  async function onSubmit(input: {
    childId: string;
    placeId: string;
    dates: DateRange;
    note?: string;
  }): Promise<ActionResult> {
    const result = await openApplication(input.childId, input.placeId, input.dates, input.note);
    if (result.ok) router.push("/applications");
    return result;
  }

  // PlanStayProps' data prop is (necessarily) named "children"; spread it in
  // rather than a literal JSX attribute so the JSX linter doesn't mistake it
  // for React's `children` special prop (same as src/app/home/page.tsx).
  const planStayProps: PlanStayProps = {
    children,
    places,
    templates: [],
    capacityWarning,
    onPlaceOrDatesChange,
    onSubmit,
    onCancel: () => router.push("/applications"),
  };

  return <PlanStay {...planStayProps} />;
}
