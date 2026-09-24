import type { DeactivatedProps } from "../types";
import { Card } from "../Card";
import { Button } from "../Button";

export function Deactivated({ email, onSignOut }: DeactivatedProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <Card letterhead className="w-full max-w-md text-center">
        <p className="font-display text-[24px] font-semibold text-text">Access not available</p>
        <p className="mt-3 text-[17px] text-text">
          This account ({email}) doesn&apos;t have access to Lyanne Visa right now. If you
          think this is a mistake, please contact the family admin.
        </p>
        <Button variant="quiet" className="mt-5" onClick={onSignOut}>
          Sign out
        </Button>
      </Card>
    </div>
  );
}
