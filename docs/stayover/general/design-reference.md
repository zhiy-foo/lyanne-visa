# Design reference — lyanne-visa

> **Variant B — "Passport & paper".** One of three visual explorations of the
> same screens and prop contracts (see [ui-design-brief.md](ui-design-brief.md)
> for what each screen shows; this file only fixes how they look). Built on
> `design/b-passport-paper` from the shared foundation in the reference
> screenshots (`docs/stayover/general/design/`), then reworked around the
> "visa" name: the app reads as a warm, tactile travel document — cream paper
> surfaces, deep ink-blue text, an oxblood/burgundy "ink" accent, and status
> badges styled as passport stamps. Screenshots for this variant live in
> `docs/stayover/reviews/foundation-screens/`. Hex values below are checked
> to WCAG AA (4.5:1 body text, 3:1 large text and UI boundaries) — computed,
> not eyeballed.

## Character

Warm, tactile, official-but-friendly — a passport rather than a form. Cream
paper surfaces in light mode, a deep ink/leather night version in dark mode
(not an inversion of the light palette — its own warm, low-key hue family).
One confident accent, a deep wine/oxblood — a passport-cover colour, chosen
to sit clearly apart from `confirmed` green, `danger` red and `attention`
amber (it's a magenta-leaning wine, not an orange-red, so it never reads as
"a second danger colour"). Status reads as a "stamp": confirmed is a solid
double-ring approval stamp pressed slightly off true, waiting-on-you is a
dashed, not-yet-inked outline — always paired with a word, never colour
alone. Dates are set as a "visa entry" block — small ENTRY/EXIT captions
over each date rather than one flat range — echoing a stamped travel
document rather than a form field. A fine engraved-line ("guilloche") wash
and perforated dividers nod at printed documents, used sparingly and always
confined to their own decorative band (a letterhead strip, a banner's left
spine) — never directly behind body copy, so they can't erode contrast.
Generous spacing, big touch targets, rounded cards — the passport idea is a
texture, not a costume; grandparents should find every screen exactly as
effortless as before.

## Tokens

### Colour — light theme ("paper", the default)

| Token | Value | Used for |
| --- | --- | --- |
| `bg` | `#f3ead9` | page background — warm cream paper |
| `surface` | `#fbf6ec` | cards, top bar, drawer — a lighter, near-white paper |
| `surface-raised` | `#ece0c5` | inputs, calendar day hover, raised chips |
| `border` | `#93804e` | card/button borders, dividers (3.2:1+ on `bg`/`surface`) |
| `text` | `#1e2a3f` | primary text — deep ink-blue |
| `muted` | `#4f5c73` | secondary lines, helper text, meta (4.5:1+ everywhere it's used) |
| `accent` | `#6b1f3a` | primary buttons (with `accent-ink` text), links, active nav, focus/selection ring, toggle, letterhead strips — deep wine/oxblood "ink" |
| `accent-ink` | `#fff8ef` | text/icons on filled `accent` |
| `attention` | `#8a5a12` | waiting-on-you: banner accent bar, badge text, dashed pending-stamp outline |
| `attention-bg` | `#f5e6c2` | attention banner and badge background |
| `confirmed` | `#1f6b45` | confirmed stamp ring + check |
| `confirmed-bg` | `#dcecd7` | confirmed day tile / badge background |
| `danger` | `#a23129` | destructive text/borders, "Allergies"-style chips |
| `danger-bg` | `#f6dcd3` | danger chip/badge background |

`accent` (9.3:1+ against `bg`/`surface`) reads as a cool magenta-wine,
deliberately kept apart in hue from `danger`'s warmer orange-red so the two
never get mistaken for each other at a glance.

### Colour — dark theme ("ink & leather")

| Token | Value | Used for |
| --- | --- | --- |
| `bg` | `#1a140f` | page background — near-black leather-brown |
| `surface` | `#241c15` | cards, top bar, drawer |
| `surface-raised` | `#2e241a` | inputs, calendar day hover |
| `border` | `#8a7154` | borders, dividers (3.3:1+ on `bg`/`surface`/`surface-raised`) |
| `text` | `#f1e6d2` | primary text — warm paper-cream |
| `muted` | `#c2ae87` | secondary/meta text |
| `accent` | `#e28aa8` | primary buttons (dark text), links, active nav, letterhead strips — a glowing rose-wine |
| `accent-ink` | `#1a140f` | text/icons on filled `accent` |
| `attention` | `#e6bd66` | waiting-on-you accents |
| `attention-bg` | `#3a2c12` | attention banner/badge background |
| `confirmed` | `#8fd9a8` | confirmed stamp ring + check |
| `confirmed-bg` | `#1e3b2a` | confirmed tile/badge background |
| `danger` | `#f0a89a` | destructive text/borders |
| `danger-bg` | `#3f1f1c` | danger chip/badge background |

The theme follows the device setting by default; the top-bar switch
(`ThemeToggle`) overrides it via `data-theme` on `<html>` and remembers the
choice on the device. Both palettes are defined once in `src/app/globals.css`
and consumed everywhere through the `bg-*`/`text-*`/`border-*` Tailwind
utilities mapped from these CSS custom properties — never hard-coded hex in
components.

### Type

- **Display / headings:** **Besley** (Google Font, via `next/font/google`,
  weights 400/600/700) — a warm slab serif with the engraved, printed-document
  character of a passport's pages. Used for "Lyanne Visa", "Hi Mum", "Event
  brief", month titles, stay dates, card titles, dialog titles — and now the
  month calendar's weekday row and day numbers (`tabular-nums`), so digits
  read unambiguously (Atkinson Hyperlegible's slashed zero made "10/20/30"
  misread as "1Ø/2Ø/3Ø" at the calendar's small size).
- **Body / UI:** **Atkinson Hyperlegible** — unchanged from the shared
  foundation; built for low-vision readers, which matters most here since
  grandparents are primary users. Never swapped out for character's sake.
- Scale (mobile → desktop): page greeting 32px; card title 24px; visa-entry
  dates 22px (display serif, `tracking-wide`); banner title 20px; section
  label 16px bold; body 17–18px; muted/meta 15px; calendar day numbers 15px
  (display serif); ENTRY/EXIT captions 11px uppercase, tracked — the one
  intentional exception to the 15px floor, since it's a purely
  supplementary label sitting directly above a 22px date, not a sentence a
  grandparent needs to read on its own.

### Shape and spacing

Unchanged from the shared foundation: cards radius 16px, 1px `border`,
padding 16–20px, 16px gap between cards, plus a subtle `shadow-sm` lift (a
sheet of paper sitting just off the page). Buttons: radius 12px, min height
48px, full-width on mobile for the main action. Chips: radius 6px. Badges
("stamps"): radius 999px, with a variant-specific ring — see below.
Spacing on a 4px grid.

### Passport textures (decorative, used sparingly)

Defined once in `globals.css`, always `aria-hidden`/purely decorative, and
confined to their own band — never layered behind body copy, so they can't
erode contrast:

- **`.bg-guilloche`** — a faint two-directional engraved-line wash (two
  `repeating-linear-gradient`s in `border` at 16–22% opacity). Applied only
  to: the page-top "letterhead" strip (`AppShell`'s top bar and drawer,
  `ApplicationDetail`'s page header, `Card`'s optional `letterhead` prop),
  and an attention banner's left spine (a dedicated 10px bar, not the
  banner's text area). Never behind text.
- **`.perforated-divider`** — a dashed 1px rule (`repeating-linear-gradient`
  in `border`) standing in for a passport leaf's perforated edge. Used
  between "Agreed dates" and "Proposed change" in the Event brief / stay
  detail card, and (as `divide-y divide-dashed`) between rows in
  `AdminAccounts`' account list.

## Components (as seen)

- **Top bar** — a 2px accent+guilloche "letterhead" strip runs across the
  very top of the page, above the header; the header itself (brand mark,
  avatar, sign-out, theme switch) sits on a plain `surface` fill with no
  texture behind its text. The nav drawer repeats the same letterhead strip
  at its own top edge for parity.
- **Navigation drawer** — unchanged: slides from the left over a dimmed
  page; current page filled `accent`/`accent-ink`, others outlined `border`;
  "Sign out" pinned at the bottom.
- **Greeting** — "Hi {name}" in Besley at the top of Overview/HostHome/
  ParentHome.
- **Attention banner** — `attention-bg` fill with a 10px `attention` +
  guilloche spine down the left edge (a dedicated band, not a wash behind
  the copy), a serif title, one plain sentence. Shown only when something
  is waiting on the viewer.
- **Month calendar** — card with serif month title between square outlined
  ‹ › buttons; weekday row and day numbers set in Besley with tabular
  figures; confirmed days = `confirmed-bg` tile with ✓; not-agreed days =
  dashed `attention` outline with "?"; the open stay's days also get an
  `accent` ring. Legend below.
- **Visa-entry dates** (`VisaDates`, shared by `Overview`'s Event brief and
  `ApplicationDetail`) — a stay's two dates set as labelled ENTRY/EXIT
  fields side by side with an arrow between them, rather than one flat
  range string; `tone="attention"` tints a pending proposal's captions and
  dates amber.
- **Status badge ("stamp")** — pill, icon-in-a-circle + label, never colour
  alone. `confirmed` reads as a solid **double-ring** stamp
  (`border-2 border-double`); `attention` reads as a **dashed** pending
  stamp (not yet inked in); `danger`/`neutral` keep a plain single ring. An
  optional `stamped` prop adds a slight ink-stamp rotation (`-rotate-2`/
  `-rotate-3`) and a heavier ring, reserved for a screen's one lead status
  (Overview's Event brief, `ApplicationDetail`'s header) — list rows
  (Applications, AdminAccounts, AdminDeliveries) keep the plain, unrotated
  stamp so repeated badges stay tidy and aligned. Label text stays normal
  case — legibility for grandparents outranks the passport conceit.
- **Event brief / Application detail** — a letterhead strip opens the page,
  then childName-at-placeName with a `stamped` status badge beneath it, the
  plain-language status banner, a `VisaDates` card (with its own
  letterhead), actions, and the history timeline. When both an agreed date
  and a proposed change are shown together, a `.perforated-divider`
  separates their two `VisaDates` blocks instead of a plain rule.
- **Cards** — `surface` fill, `border` outline, 16px radius, a subtle
  `shadow-sm` lift, and an optional `letterhead` prop (a 2px accent+
  guilloche band clipped to the card's top corners) used on one lead card
  per screen — never on a card holding something that needs to overflow
  its edge (e.g. an `InfoTip` popover), since `letterhead` clips.
- **Buttons** — unchanged roles (primary filled `accent`/`accent-ink`,
  secondary outlined `border`, destructive `danger` text on outline filled
  only inside the confirm dialog, quiet/links `accent` underlined); colours
  now read as oxblood/wine ink rather than terracotta or periwinkle-blue.

## Applying it to every screen

All screens (`SignIn`, `Register`, `Waiting`, `Deactivated`, `ParentHome`,
`HostHome`, `AdminAccounts`, `AdminChildren`, `AdminHomes`,
`AdminDeliveries`, `Overview`, `Applications`, `PlanStay`,
`ApplicationDetail`) are built from the shared components above — `Card`,
`Badge`, `Banner`, `Button`, `VisaDates`, `TextField`/`Select`/`Textarea`/
`DateRangePicker`, `Collapsible`, `ConfirmDialog`, `InfoTip`, `Chip` — and
pick up this variant's palette, type and stamp/texture treatment
automatically through the shared CSS tokens, with no per-screen prop or
copy changes. For parity, one lead card per screen also carries
`letterhead`: `SignIn`, `Register`, `Waiting`, `Deactivated`'s single card;
`Overview`'s Event brief; `ApplicationDetail`'s dates card; `PlanStay`'s
form card; `Applications`' and `ParentHome`/`HostHome`'s empty-state cards.
Busy list cards that hold an `InfoTip` (`AdminAccounts`' account list) stay
without `letterhead` so its popover can still escape the card's edge; that
list instead carries the perforated (`divide-dashed`) row dividers.
