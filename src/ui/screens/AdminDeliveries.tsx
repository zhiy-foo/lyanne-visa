import type { AdminDeliveriesProps } from "../types";
import { Card } from "../Card";
import { Badge } from "../Badge";

/** Task 5.1: a small admin view of recent failed deliveries
 * (ui-design-brief.md has no screen for this — see AdminDeliveriesProps'
 * own comment in ../types.ts). Read-only, no actions — there is nothing to
 * do here beyond seeing what failed and why. */
export function AdminDeliveries({ dispatches }: AdminDeliveriesProps) {
  return (
    <div className="flex flex-col gap-5">
      <p className="font-display text-[32px] font-semibold text-text">Deliveries</p>

      {dispatches.length === 0 ? (
        <Card className="text-center">
          <p className="text-[17px] text-muted">No failed deliveries — everything has gone out fine.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {dispatches.map((dispatch) => (
            <Card key={dispatch.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[16px] font-bold text-text">{dispatch.toEmail}</p>
                <Badge
                  variant="danger"
                  icon="!"
                  label={dispatch.kind === "invite" ? "Calendar invite" : "Notice"}
                />
              </div>
              <p className="text-[15px] text-danger">{dispatch.lastError}</p>
              <p className="text-[13px] text-muted">{new Date(dispatch.updatedAt).toLocaleString()}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
