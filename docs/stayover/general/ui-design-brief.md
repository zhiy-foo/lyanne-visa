# UI design brief — lyanne-visa

> The screen-by-screen UI contract: what each screen shows, its typed props and
> the actions it reports. The **look** is fixed separately in
> [design-reference.md](design-reference.md) (from the user's reference
> screenshots). Originally written as a brief for an external design assistant, it
> is self-contained and can still be used that way.

## 1. What the app is

A private web app for one family to arrange **stayovers** for a child, Lyanne, at
her grandparents' home while her parents travel overseas.

- Everyone **registers themselves** with one role — **parent** or **host**. With
  the family join code they can use the app straight away; without it they wait
  for the admin to approve them. Parents add their children; hosts add their homes.
  An **admin** account oversees everyone's accounts.
- **Parents** submit a stayover **application**: which child, which home, which
  dates (drop-off day to pick-up day), plus an optional note.
- **Hosts** (the grandparents) **accept**, **decline**, or **suggest other dates**.
- Either side can keep suggesting dates. A stay is **confirmed only when both sides
  agree on the same dates**. A confirmed stay can later be changed (same
  back-and-forth — the old dates stand until the new ones are accepted) or
  cancelled by either side.
- Each stay has **details**: care notes (bedtime, meals, allergies, medicine,
  school), drop-off and pick-up arrangements (time, place, who drives), the
  parents' flights, and contacts (emergency numbers, how to reach the parents
  abroad). Parents can save details as a reusable **template**.
- When dates are agreed, changed or cancelled, everyone involved gets an **email
  calendar invite** that adds, moves or removes the stay in their own calendar.

The name is a playful nod to a visa application — the child "applies" to visit her
grandparents. A light, warm touch of that theme (e.g. an "approved" stamp on a
confirmed stay, a passport-like stay card) is welcome but must never get in the way
of clarity.

## 2. Who uses it — design for them

| Person | Role in the app | What matters to them |
| --- | --- | --- |
| Lyanne's parents | parent side — create and manage applications | quick to submit, clear status, confidence the grandparents have everything they need |
| Grandma & Grandpa | host side — respond to applications | **large, legible text, obvious buttons, no jargon**, works well on a phone |
| The admin (a relative who runs the app) | oversees accounts; never takes part in applications | a clear account list, quick deactivate |

Assume **phones first** (grandparents will mostly use phones), then tablets and
desktop. Accessibility is a requirement, not a nice-to-have: minimum 16px body
text (18px+ preferred), WCAG AA contrast, touch targets ≥ 44px, never convey status
by colour alone (always a word and/or icon too), support dark mode.

Tone of all wording: warm, plain, short. "Grandma & Grandpa's", not "Place #1".
"Waiting for Grandma & Grandpa", not "PENDING_HOST".

## 3. Deliverables and technical constraints

Please produce:

1. **A small design system**: colour tokens (light + dark), type scale, spacing,
   radius, and these components — button (primary / secondary / danger / quiet),
   text input, date-range picker, select, checkbox, textarea, status badge, card,
   banner/alert, timeline item, empty state, confirm dialog, top bar with sign-out.
2. **Every screen in section 5**, including the states listed for each.
3. **The two email templates in section 6** (simple HTML email; must look fine in
   Gmail with images off).

Technical constraints so the designs drop straight into the code:

- **React + TypeScript function components, styled with Tailwind CSS.** No other UI
  library unless it is tiny and headless.
- Components are **presentational only**: they receive data through typed props and
  report user actions through callback props (e.g. `onAccept()`), and never fetch
  data, call APIs, read cookies or use routing libraries directly.
- Use the **prop types given in section 5** (you may add optional presentational
  props; do not rename or remove the given ones).
- Show **pending/submitting** states: every action callback may be async, so
  buttons need a busy state, and forms need an error area for a message string.
- One file per screen plus one per shared component; name files after the
  component (e.g. `ApplicationDetail.tsx`).

A free chat has limited length, so a good order is: design system first, then one
or two screens per message.

## 4. Shared vocabulary

**Application status** — always show both a label and an icon:

| Status | Label (parent view) | Label (host view) |
| --- | --- | --- |
| waiting for hosts | "Waiting for Grandma & Grandpa" | "Your answer needed" |
| waiting for parents | "Your answer needed" | "Waiting for Mum & Dad" |
| confirmed | "Confirmed" (approved stamp) | "Confirmed" |
| confirmed, change requested | "Confirmed · change requested" | same |
| declined | "Declined" | "Declined" |
| cancelled | "Cancelled" | "Cancelled" |

The words "Grandma & Grandpa" / "Mum & Dad" come from data (place name / member
names) — don't hard-code them.

**Dates** — a stay runs from **drop-off day** to **pick-up day**; show as
"Fri 3 Oct → Tue 7 Oct · 4 nights". Times are local to the grandparents' home.

**Shared types used below:**

```ts
type Side = 'parent' | 'host';
type Phase = 'negotiating' | 'confirmed' | 'declined' | 'cancelled';
type DateRange = { start: string; end: string }; // ISO dates, e.g. '2026-10-03'
type Person = { id: string; name: string; email: string };
type ActionResult = { ok: true } | { ok: false; message: string };
```

## 5. Screens

### Stage 1 — sign-in, registration and accounts

**`SignIn`** — email field + "Email me a sign-in link" button, and "Sign in with
Google" button.
```ts
type SignInProps = {
  error?: 'link-expired' | 'google-cancelled' | 'generic';
  onRequestLink(email: string): Promise<ActionResult>;
  onGoogle(): void;
};
```
States: default · link sent ("Check your email at …") · link expired/used · Google
cancelled · generic error.

**`Register`** — first visit after signing in: choose a role, a name, and
optionally the family code. Make the two roles big, friendly choices ("I'm a
parent — I'll ask for stays" / "I'm a host — I'll welcome Lyanne at my home").
Explain the role can't be changed later without asking the admin, and that without
a code the admin will approve them.
```ts
type RegisterProps = {
  email: string;
  codeAttemptsLeft: number;              // 0 ⟹ hide the code field, waiting list only
  onRegister(role: Side, name: string, code?: string): Promise<ActionResult>;
  onSignOut(): void;
};
```
States: default · wrong code ("That code isn't right — try again, or leave it blank
to ask the admin") · no attempts left · validation errors.

**`Waiting`** — "Thanks, {name}! The admin needs to approve your account before
you can start. You'll be able to sign in and continue once they have."
```ts
type WaitingProps = { name: string; email: string; onSignOut(): void };
```

**`Deactivated`** — "Your account ({email}) has been switched off. Contact the
family admin if this is a mistake."
```ts
type DeactivatedProps = { email: string; onSignOut(): void };
```

**`ParentHome`** — a parent's page for setting up their children (later stages add
their stays to this page).
```ts
type ParentHomeProps = {
  me: { name: string; email: string };
  children: { id: string; name: string; parents: { id: string; name: string; email: string }[] }[];
  homes: { id: string; name: string; timeZone: string }[];   // directory: no addresses
  onAddChild(name: string): Promise<ActionResult>;
  onRenameChild(childId: string, name: string): Promise<ActionResult>;
  onAddCoParent(childId: string, email: string): Promise<ActionResult>;
  onRemoveParent(childId: string, memberId: string): Promise<ActionResult>;
};
```
States: no children yet (friendly "Add your child" prompt) · child with one parent ·
child with co-parents · refusals ("No parent account with that email — ask them to
register as a parent first", "Every child needs at least one parent").

**`HostHome`** — a host's page for setting up their home(s).
```ts
type HostHomeProps = {
  me: { name: string; email: string };
  homes: { id: string; name: string; address?: string; timeZone: string; hosts: { id: string; name: string; email: string }[] }[];
  timeZones: string[];
  onAddHome(input: { name: string; address?: string; timeZone: string }): Promise<ActionResult>;
  onUpdateHome(homeId: string, input: { name: string; address?: string; timeZone: string }): Promise<ActionResult>;
  onAddCoHost(homeId: string, email: string): Promise<ActionResult>;
  onRemoveHost(homeId: string, memberId: string): Promise<ActionResult>;
};
```
States: no home yet (friendly "Add your home" prompt) · home with co-hosts ·
refusals ("No host account with that email", "Every home needs at least one host",
"Please choose a valid time zone"). Time-zone picker: searchable, with the device's
zone suggested.

The admin area is three screens, one per `/admin/accounts`, `/admin/children` and
`/admin/homes` route (a shared drawer nav links between them; `/admin` itself just
redirects to `/admin/accounts`). They share these row shapes:
```ts
type AdminAccount = {
  id: string; name: string; email: string; role: Side;
  status: 'waiting' | 'active' | 'deactivated';
  registeredAt: string;          // ISO datetime
  childIds: string[]; homeIds: string[];
};
type AdminChild = { id: string; name: string; parentIds: string[] };
type AdminHome = { id: string; name: string; address?: string; timeZone: string; hostIds: string[] };
```

**`AdminAccounts`** — the join code, the waiting list, and every account.
```ts
type AdminAccountsProps = {
  accounts: AdminAccount[];
  joinCodeSet: boolean;
  onApprove(accountId: string): Promise<ActionResult>;
  onDecline(accountId: string): Promise<ActionResult>;
  onSetJoinCode(code: string | null): Promise<ActionResult>;   // null clears it
  onDeactivate(accountId: string): Promise<ActionResult>;
  onReactivate(accountId: string): Promise<ActionResult>;
  onSetRole(accountId: string, role: Side): Promise<ActionResult>;   // only when unlinked
};
```
States: waiting accounts first, each with Approve / Decline · join code set / not
set (the code is never shown back, only "Change" or "Clear") · newly registered
accounts with no links highlighted ("New — not linked to anyone yet") · deactivated
accounts greyed with "Reactivate" · confirm dialog before deactivating · every
non-deactivated account's Role dropdown is disabled with the hint "Unlink from
children/homes to change role" once it has any child or home link, enabled while
unlinked · refusals ("Remove this account's links before changing its role").

**`AdminChildren`** — one collapsible card per child.
```ts
type AdminChildrenProps = {
  children: AdminChild[];
  accounts: AdminAccount[];      // to list/link parents
  onRenameChild(childId: string, name: string): Promise<ActionResult>;
  onLinkParent(childId: string, accountId: string, linked: boolean): Promise<ActionResult>;
};
```
States: no children yet · one child (its card defaults open) · several children
(cards default collapsed, each header showing the name and "N parents") · expanded
card shows Rename, linked parents with Unlink, and "Link a parent" · refusals
("Every child needs a name.", "Couldn't update this link — try again.").

**`AdminHomes`** — one collapsible card per home.
```ts
type AdminHomesProps = {
  homes: AdminHome[];
  accounts: AdminAccount[];      // to list/link hosts
  timeZones: string[];
  onUpdateHome(homeId: string, input: { name: string; address?: string; timeZone: string }): Promise<ActionResult>;
  onLinkHost(homeId: string, accountId: string, linked: boolean): Promise<ActionResult>;
};
```
States: no homes yet · one home (its card defaults open) · several homes (cards
default collapsed, each header showing the name and "N hosts") · expanded card
shows address, time zone, Edit, linked hosts with Unlink, and "Link a host" ·
refusals ("Please choose a valid time zone.", "Couldn't update this link — try
again.").

### Stage 2 — applications and the back-and-forth

**`StaysHome`** — the landing page after sign-in: a list of stays, grouped:
"Needs your answer" (top, prominent) · "Upcoming" · "Past & closed".
```ts
type StaySummary = {
  id: string;
  childName: string;
  placeName: string;
  dates: DateRange;          // agreed dates, or the dates currently proposed
  phase: Phase;
  awaiting?: Side;           // whose turn, if anyone's
  viewerSide: Side;
};
type StaysHomeProps = {
  stays: StaySummary[];
  canCreate: boolean;        // parents only
  onOpen(id: string): void;
  onNew(): void;
};
```
States: no stays yet (parents: big "Plan a stay" call to action; hosts: "Nothing to
answer yet") · several stays across groups. In stage 2 this list sits at the top of
`ParentHome` / `HostHome`.

**`NewApplication`** — parents only.
```ts
type NewApplicationProps = {
  children: { id: string; name: string }[];
  places: { id: string; name: string }[];
  templates: { id: string; name: string }[];   // stage 3; may be empty
  onSubmit(input: { childId: string; placeId: string; dates: DateRange; note?: string; templateId?: string }): Promise<ActionResult>;
  onCancel(): void;
};
```
Pre-select when there is only one child / one place (the common case). Refusal
example: "Lyanne already has a confirmed stay on those dates".

**`ApplicationDetail`** — the heart of the app.
```ts
type Move = {
  kind: 'propose' | 'accept' | 'decline' | 'cancel';
  side: Side;
  byName: string;
  at: string;                // ISO datetime
  dates?: DateRange;         // for 'propose'
  note?: string;
};
type ApplicationDetailProps = {
  childName: string;
  placeName: string;
  viewerSide: Side;
  phase: Phase;
  awaiting?: Side;
  agreed?: DateRange;        // confirmed dates, if any
  proposed?: DateRange;      // open proposal waiting for an answer, if any
  history: Move[];           // oldest first
  can: { accept: boolean; decline: boolean; propose: boolean; cancel: boolean; delete: boolean };
  onAccept(): Promise<ActionResult>;
  onDecline(note?: string): Promise<ActionResult>;
  onPropose(dates: DateRange, note?: string): Promise<ActionResult>;
  onCancel(note?: string): Promise<ActionResult>;
  onDelete(): Promise<ActionResult>;   // only while no host has answered
  details?: StayDetailsProps;          // stage 3
};
```
Layout: a status banner at the top saying plainly what's happening and what (if
anything) the viewer needs to do; the dates (agreed and/or proposed — make the
difference obvious when a change is pending); the action buttons the viewer is
allowed (`can`); the history as a simple conversation-style timeline ("Mum asked
for Fri 3 → Tue 7 Oct", "Grandma suggested Sat 4 → Tue 7 Oct", "Mum accepted").
Destructive actions (decline, cancel, delete) need a confirm dialog with an
optional note. "Suggest other dates" opens a date-range picker with an optional
note.
States: waiting for the other side · your answer needed · confirmed · confirmed
with a change pending · declined · cancelled (read-only) · refusal message.

### Stage 3 — stay details and templates

**`StayDetails`** — sections inside `ApplicationDetail`, editable by both sides.
```ts
type StayDetailsProps = {
  careNotes: { id?: string; topic: string; body: string }[];
  handovers: { kind: 'drop-off' | 'pick-up'; date?: string; time?: string; location?: string; by?: string }[];
  flights: { leg: 'outbound' | 'return'; number: string; from: string; to: string; departs: string; arrives: string }[];
  contacts: { name: string; relationship: string; phone: string; email?: string; notes?: string }[];
  editable: boolean;
  onSave(next: Omit<StayDetailsProps, 'editable' | 'onSave' | 'onSaveAsTemplate'>): Promise<ActionResult>;
  onSaveAsTemplate?(name: string): Promise<ActionResult>;   // parents only
};
```
Handover dates come from the stay dates (drop-off = first day, pick-up = last
day), so only time, place and driver are edited. Show flight times with their
own time zones. Make phone numbers tappable. Sections collapse on mobile; care
notes like "Allergies" and "Medicine" should stand out.

**`Templates`** — list, rename, delete, edit (same editor as `StayDetails`,
without dates). Parents only.

### Stage 4 — email invites (no new screen)

Small addition to `ApplicationDetail`: a quiet line "Calendar invites sent to 4
people" / "Couldn't send to Grandpa — we'll stop retrying after 3 attempts". Plus a
one-time tip on `StaysHome`: "Add {app email} to your contacts so invites go
straight into your calendar."

## 6. Emails

Plain, readable HTML (single column, ≤ 600px, system fonts, one clear button, all
information also present as text):

1. **Your turn** — e.g. subject "Mum asked for Lyanne to stay Fri 3 – Tue 7 Oct";
   body: who asked for what, their note, a button "Open the application".
2. **Calendar invite** — accompanies the calendar attachment; subject "Confirmed:
   Lyanne at Grandma & Grandpa's, Fri 3 – Tue 7 Oct" (or "Updated:" / "Cancelled:");
   body: dates, drop-off and pick-up times if known, a link to the stay.

## 7. Out of scope for the designer

Data loading, sign-in mechanics, permissions logic and email sending are handled in
the code — the designer only needs the props and callbacks above. If something in
a screen seems to need data not in its props, add it as an **optional** prop and
note it, rather than fetching it.
