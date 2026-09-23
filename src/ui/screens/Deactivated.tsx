import type { DeactivatedProps } from "../types";
import { Card } from "../Card";
import { Button } from "../Button";

export function Deactivated({ email, onSignOut }: DeactivatedProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <Card className="w-full max-w-md text-center">
        <p className="font-display text-[24px] font-semibold text-text">Account switched off</p>
        <p className="mt-3 text-[17px] text-text">
          Your account ({email}) has been switched off. Contact the family admin if this
          is a mistake.
        </p>
        <Button variant="quiet" className="mt-5" onClick={onSignOut}>
          Sign out
        </Button>
      </Card>
    </div>
  );
}
