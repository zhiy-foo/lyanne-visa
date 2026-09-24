import type { WaitingProps } from "../types";
import { Card } from "../Card";
import { Button } from "../Button";

export function Waiting({ name, email, onSignOut }: WaitingProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <Card letterhead className="w-full max-w-md text-center">
        <p className="font-display text-[24px] font-semibold text-text">Thanks, {name}!</p>
        <p className="mt-3 text-[17px] text-text">
          The admin needs to approve your account before you can start. You&apos;ll be able
          to sign in and continue once they have.
        </p>
        <p className="mt-2 text-[15px] text-muted">Signed in as {email}.</p>
        <Button variant="quiet" className="mt-5" onClick={onSignOut}>
          Sign out
        </Button>
      </Card>
    </div>
  );
}
