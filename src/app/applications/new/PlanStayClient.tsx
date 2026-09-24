"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PlanStay } from "@/ui/screens/PlanStay";
import type { ActionResult, DateRange, PlanStayProps } from "@/ui/types";
import { checkCapacityWarning, openApplication } from "@/stayover/actions/stays";

type Props = Pick<PlanStayProps, "children" | "places">;

/** PlanStayProps.capacityWarning is synchronous (src/ui/types.ts) but the
 * capacity read is a server call — this wrapper fires the server action as
 * a side effect of being asked for a warning and caches the answer, so the
 * *next* render (after start/end/place settle) can return it synchronously.
 * A one-render lag is an acceptable trade for keeping src/ui's contract
 * simple and Supabase-free (design Decision 5's read is not a refusal, so
 * there is nothing unsafe about the form being submittable before the
 * warning has loaded). */
export function PlanStayClient({ children, places }: Props) {
  const router = useRouter();
  const [cache, setCache] = useState<Record<string, string | undefined>>({});
  const pending = useRef<Set<string>>(new Set());

  const capacityWarning = useCallback(
    (placeId: string, dates: DateRange) => {
      const key = `${placeId}|${dates.start}|${dates.end}`;
      if (key in cache) return cache[key];
      if (!pending.current.has(key)) {
        pending.current.add(key);
        const placeName = places.find((p) => p.id === placeId)?.name ?? "";
        checkCapacityWarning(placeId, placeName, dates)
          .then((message) => setCache((current) => ({ ...current, [key]: message })))
          .catch(() => setCache((current) => ({ ...current, [key]: undefined })));
      }
      return undefined;
    },
    [cache, places],
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
    onSubmit,
    onCancel: () => router.push("/applications"),
  };

  return <PlanStay {...planStayProps} />;
}
