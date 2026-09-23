# Design reference — lyanne-visa

> The visual design, written down from the reference screenshots the user supplied
> on 2026-09-24 (a parent's Overview in dark mode, the Event brief card, and the
> open navigation drawer). Screenshots, when saved, live in
> `docs/stayover/general/design/`. Prop contracts per screen are in
> [ui-design-brief.md](ui-design-brief.md); this file fixes how they look.
> Hex values are read off screenshots — treat them as the palette's intent and
> tune for WCAG AA contrast.

## Character

Calm, warm, very legible. Deep navy surfaces, one soft periwinkle-blue accent for
actions, warm amber for anything waiting on someone, green for confirmed. Serif
display headings give it a friendly, slightly "official document" feel (the visa
theme) without costumes. Generous spacing, big touch targets, rounded cards.

## Tokens

### Colour — dark theme (the reference)

| Token | Value | Used for |
| --- | --- | --- |
| `bg` | `#0e1526` | page background |
| `surface` | `#16213a` | cards, top bar, drawer |
| `surface-raised` | `#1c2a47` | calendar day cells on hover, inputs |
| `border` | `#2b3b5e` | card and outlined-button borders, dividers |
| `text` | `#f2f5fb` | primary text |
| `text-muted` | `#9fb0cf` | secondary lines ("3 nights · Lyanne at …", weekday labels) |
| `accent` | `#8ab4f8` | primary buttons (with `bg`-coloured text), links (underlined), active nav item, today/selected ring, toggle |
| `attention` | `#f6c177` | waiting-on-you: banner accent bar, badge text, dashed "?" day outline and digits |
| `attention-bg` | `#3a2b10` | attention banner and badge background |
| `confirmed` | `#6ee7a8` | confirmed check |
| `confirmed-bg` | `#1d4a38` | confirmed day tile / badge background |
| `danger` | `#f28b82` | "Allergies" chip text, destructive buttons |
| `danger-bg` | `#4a1f22` | "Allergies" chip background |
| `caution` | `#f6c177` on `#3a2b10` | "Medicine" chip (same as attention) |

### Colour — light theme (derived; not in the screenshots)

Same roles, inverted: `bg #f6f7fb`, `surface #ffffff`, `surface-raised #eef2f9`,
`border #d5dcea`, `text #121a2e`, `text-muted #56637f`, `accent #2f5fd0` (white text
on buttons), `attention #9a5b00` on `attention-bg #fff1d6`, `confirmed #17784a` on
`confirmed-bg #dcf5e8`, `danger #b3261e` on `danger-bg #fde7e6`. Verify AA.

The theme follows the device setting by default; the top-bar switch overrides it
and is remembered on the device.

### Type

- **Display / headings:** a warm serif — use **Fraunces** (Google Fonts), semibold.
  Seen in "Lyanne Visa", "Hi Mum", "October 2026", "Event brief", "Sat 3 Oct → Tue 6 Oct", banner titles.
- **Body / UI:** **Atkinson Hyperlegible** (Google Fonts) — the screenshots' body
  face has slashed zeros ("9:00", "10"), and Atkinson is built for low-vision readers,
  which suits the grandparents.
- Scale (mobile → desktop): page greeting 32px; card title 24px; stay dates 24px;
  banner title 20px; section label 16px bold; body 17–18px; muted/meta 15px; never
  below 15px.

### Shape and spacing

Cards: radius 16px, 1px `border`, padding 16–20px, 16px gap between cards. Buttons:
radius 12px, min height 48px, full-width on mobile for the main action. Chips and
badges: radius 999px (badge) / 6px (chip), 4×10px padding. Spacing on a 4px grid.

## Components (as seen)

- **Top bar** — left: app icon + "Lyanne Visa" in the display serif + a small caret
  that opens the navigation drawer. Right: avatar circle (initial on `accent`), the
  member's name, underlined "Sign out" link, and the light/dark switch.
- **Navigation drawer** — slides from the left over a dimmed page. Stacked
  full-width nav buttons: the current page filled `accent` with dark text, others
  outlined (`border`) with light text. "Sign out" link pinned at the bottom.
  Parent items: Overview · Applications · Plan a stay. Host items: Overview ·
  Applications (and "My home"). Admin items: Accounts · Join code. Stage-1 builds
  add "My children" (parents) / "My home" (hosts) until the later pages exist.
- **Greeting** — "Hi {name}" in the display serif at the top of Overview.
- **Attention banner** — `attention-bg` with a 4px `attention` bar on the left,
  serif title ("1 stay needs your answer"), one plain sentence of guidance. Shown
  only when something is waiting on the viewer.
- **Month calendar** (stage 2) — card with serif month title between square outlined
  ‹ › buttons; weekday row Mon–Sun in `text-muted`; stay days:
  confirmed = `confirmed-bg` tile with ✓; not agreed = dashed `attention` outline
  with the date and a small "?" in `attention`; the currently open stay's days also
  get an `accent` ring. Legend below: "✓ Confirmed" and "? Not agreed yet". Tapping
  a stay day opens its Event brief.
- **Status badge** — pill, icon in a circle + label ("! Your answer needed" on
  `attention-bg`; "✓ Confirmed" on `confirmed-bg`).
- **Event brief** (stages 2–3) — card: title "Event brief"; status badge; dates in
  the display serif ("Sat 3 Oct → Tue 6 Oct"); muted line "3 nights · Lyanne at
  Grandma & Grandpa's"; an inner attention banner for the latest move ("Grandma
  suggested other dates" + her note); then divider-separated sections with bold
  labels: **Drop-off** and **Pick-up** ("Sat 3 Oct, 9:00 am · Mum drives ·
  Grandma & Grandpa's home"), **Look out for** (chips — "Allergies" in danger colours,
  "Medicine" in attention colours — followed by the text, then muted routine notes
  like "Bedtime 8:00 pm · School bus 7:15 am"), **Parents' flights** (one line per
  leg with local time and zone abbreviation), **Contacts** (name · tappable `tel:`
  link in `accent`). Ends with a full-width primary button for the viewer's next
  action ("Answer this request").
- **Buttons** — primary: filled `accent`, dark text; secondary: outlined `border`,
  light text; destructive: `danger` text on outline, filled only inside the confirm
  dialog; links: `accent`, underlined.

## Applying it to stage-1 screens (not in the screenshots)

Use the same shell and cards. **Register**: two large selectable cards ("I'm a
parent…" / "I'm a host…", selected = `accent` ring), name field, optional "Family
code" field with helper text "Don't have one? Leave it blank — the admin will
approve you." **Waiting** / **Deactivated**: a single centred card with the serif
title, one sentence and sign-out. **My children / My home**: one card per child or
home with its people listed and small outlined "Add co-parent"/"Add co-host"
actions; an empty state card with a primary button. **Admin**: attention banner
"{n} accounts waiting" at top; waiting accounts as cards with Approve (primary) /
Decline (destructive outline); then an accounts table/list with status badges
(Active / Waiting / Deactivated) and per-row actions; a "Join code" card with a
masked field and "Change code" / "Clear code".
