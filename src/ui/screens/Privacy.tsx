import type { ReactNode } from "react";
import { Card } from "../Card";

// Public, static screen — reachable signed out AND in any signed-in account
// state (src/stayover/routing.ts's ALWAYS_PUBLIC_PATHS). No AppShell/member
// nav here (this isn't a page the signed-in app's own nav ever points to);
// a simple top bar with the brand and a link back to "/" instead, matching
// how SignIn/Waiting/Deactivated lay out their own full-page Card without
// AppShell.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-[20px] font-semibold text-text">{title}</h2>
      <div className="mt-2 flex flex-col gap-2 text-[16px] text-text">{children}</div>
    </section>
  );
}

export function Privacy() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <span aria-hidden="true" className="bg-guilloche block h-2 shrink-0 bg-accent" />
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 sm:px-6">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-ink"
          >
            L
          </span>
          <span className="truncate font-display text-[20px] font-semibold whitespace-nowrap text-text">
            Lyanne Visa
          </span>
        </span>
        {/* Plain <a>, not next/link — src/ui stays router-agnostic (see the
            comment atop src/app/dev/gallery/registry.tsx); the other
            internal links this screen is linked from (SignIn, Register)
            use a plain <a> to /privacy for the same reason. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          className="flex min-h-[44px] items-center text-[17px] font-semibold text-accent underline underline-offset-2"
        >
          Back to home
        </a>
      </header>

      <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-10 sm:px-6">
        <Card letterhead>
          <p className="font-display text-[32px] font-semibold text-text">Privacy policy</p>
          <p className="mt-1 text-[15px] text-muted">Last updated: 25 September 2026</p>

          <p className="mt-4 text-[16px] text-text">
            Lyanne Visa is a small, private app one family uses to plan a child&apos;s
            stayovers at grandparents&apos; and other hosts&apos; homes. It is not open to
            the public — only people the admin has approved can sign in. This page explains,
            in plain terms, what information the app keeps and why.
          </p>

          <Section title="What we store">
            <p>When you have an account, we keep:</p>
            <ul className="list-disc pl-5">
              <li>Your account name, email address, role (parent or host) and status.</li>
              <li>Children&apos;s names, and which parents are linked to each child.</li>
              <li>Homes/places, including their name, address (if you add one), time zone and any capacity you set, and which hosts are linked to each one.</li>
              <li>Stay applications: the child and home involved, proposed dates, the back-and-forth of accepting, rejecting, proposing again or cancelling, and any notes left along the way.</li>
              <li>A record of the notification and invite emails the app has sent or tried to send (the recipient address, what kind of email it was, and whether it was sent, still pending, or failed).</li>
              <li>Whether you&apos;ve dismissed the &ldquo;contacts&rdquo; tip, so it doesn&apos;t keep reappearing.</li>
            </ul>
          </Section>

          <Section title="Signing in with Google">
            <p>
              If you sign in with Google, we only ever ask for the basic information Google
              calls your &ldquo;openid&rdquo;, email and profile scopes — in practice, your name and
              email address. We don&apos;t request access to your contacts, calendar, photos
              or anything else in your Google account.
            </p>
          </Section>

          <Section title="Who handles this data for us">
            <p>We don&apos;t run our own servers. The app relies on:</p>
            <ul className="list-disc pl-5">
              <li><strong>Supabase</strong> — sign-in and the database that stores everything above.</li>
              <li><strong>Vercel</strong> — hosting the website itself.</li>
              <li><strong>Google</strong> — sign-in, if you choose that option.</li>
              <li><strong>Gmail</strong> — sending notification and invite emails from a dedicated app email account.</li>
            </ul>
          </Section>

          <Section title="Cookies and things stored in your browser">
            <ul className="list-disc pl-5">
              <li>A sign-in session cookie set by Supabase, so you stay signed in between visits.</li>
              <li>A light/dark theme preference, saved in your browser&apos;s local storage.</li>
            </ul>
            <p>We don&apos;t use analytics, advertising or tracking cookies of any kind.</p>
          </Section>

          <Section title="Who can see what">
            <p>
              Parents only see the children, homes and applications they&apos;re linked to;
              hosts only see the homes, applications and (once involved in a stay) children
              linked to them. The admin can see and manage accounts, children and homes so
              they can run the family&apos;s side of the app.
            </p>
          </Section>

          <Section title="Sharing">
            <p>
              We never sell your data, and we don&apos;t use it for advertising. It is only
              used to run this app for your family.
            </p>
          </Section>

          <Section title="Keeping and deleting data">
            <p>
              Deleting a stay application removes it, and its full history, completely —
              but only while no host has responded to it yet; once a host has replied, it
              can be cancelled instead of deleted, keeping a record of what happened.
            </p>
            <p>
              The admin can permanently delete an account once it has been deactivated and
              has no history left behind (no linked children, homes or applications). That
              removes the account entirely; it doesn&apos;t touch your underlying Google
              account, so you could sign in and be added again later.
            </p>
            <p>
              [OWNER TO CONFIRM: where Supabase/Vercel host this data (region/country), and
              how long database backups are kept after data is deleted]
            </p>
          </Section>

          <Section title="Access, correction or deletion">
            <p>
              To ask what we hold about you, correct it, or have it deleted, email{" "}
              <a
                href="mailto:lyanne.stayovers@gmail.com"
                className="font-semibold text-accent underline underline-offset-2"
              >
                lyanne.stayovers@gmail.com
              </a>
              .
            </p>
          </Section>
        </Card>
      </main>
    </div>
  );
}
