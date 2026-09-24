# Design reference — lyanne-visa

> **Variant B — "Passport & paper".** One of three visual explorations of the
> same screens and prop contracts (see [ui-design-brief.md](ui-design-brief.md)
> for what each screen shows; this file only fixes how they look). Built on
> `design/b-passport-paper` from the shared foundation in the reference
> screenshots (`docs/stayover/general/design/`), then reworked around the
> "visa" name: the app reads as a warm, tactile travel document — cream paper
> surfaces, deep ink-blue text, a terracotta "ink stamp" accent, and status
> badges styled as passport stamps. Screenshots for this variant live in
> `docs/stayover/reviews/foundation-screens/`. Hex values below are checked
> to WCAG AA (4.5:1 body text, 3:1 large text and UI boundaries) — see the
> worked contrast figures in this variant's handoff notes if you need to
> retune a token.

## Character

Warm, tactile, official-but-friendly — a passport rather than a form. Cream
paper surfaces in light mode, a deep ink/leather night version in dark mode
(not an inversion of the light palette — its own warm, low-key hue family).
One confident accent, terracotta, standing in for ink. Status reads as a
"stamp": confirmed is a solid double-ring approval stamp, waiting-on-you is a
dashed, not-yet-inked outline — always paired with a word, never colour
alone. A fine engraved-line ("guilloche") wash and a perforated-edge divider
nod at printed documents, used sparingly — on the top bar, the attention
banner, and between agreed/proposed dates — and always sit behind or beside
text, never under it, so they can't erode contrast. Generous spacing, big
touch targets, rounded cards — the passport idea is a texture, not a
costume; grandparents should find every screen exactly as effortless as
before.

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
| `accent` | `#b1481f` | primary buttons (with `accent-ink` text), links, active nav, focus/selection ring, toggle — terracotta "ink" |
| `accent-ink` | `#fff8ef` | text/icons on filled `accent` |
| `attention` | `#8a5a12` | waiting-on-you: banner accent bar, badge text, dashed pending-stamp outline |
| `attention-bg` | `#f5e6c2` | attention banner and badge background |
| `confirmed` | `#1f6b45` | confirmed stamp ring + check |
| `confirmed-bg` | `#dcecd7` | confirmed day tile / badge background |
| `danger` | `#a23129` | destructive text/borders, "Allergies"-style chips |
| `danger-bg` | `#f6dcd3` | danger chip/badge background |

### Colour — dark theme ("ink & leather")

| Token | Value | Used for |
| --- | --- | --- |
| `bg` | `#1a140f` | page background — near-black leather-brown |
| `surface` | `#241c15` | cards, top bar, drawer |
| `surface-raised` | `#2e241a` | inputs, calendar day hover |
| `border` | `#8a7154` | borders, dividers (3.3:1+ on `bg`/`surface`/`surface-raised`) |
| `text` | `#f1e6d2` | primary text — warm paper-cream |
| `muted` | `#c2ae87` | secondary/meta text |
| `accent` | `#e58f52` | primary buttons (dark text), links, active nav — a glowing terracotta |
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
  brief", month titles, stay dates, card titles, dialog titles.
- **Body / UI:** **Atkinson Hyperlegible** — unchanged from the shared
  foundation; built for low-vision readers, which matters most here since
  grandparents are primary users. Never swapped out for character's sake.
- Scale (mobile → desktop): page greeting 32px; card title 24px; stay dates
  24px (display serif, `tracking-wide`, so dates read like a printed passport
  entry); banner title 20px; section label 16px bold; body 17–18px;
  muted/meta 15px; never below 15px.

### Shape and spacing

Unchanged from the shared foundation: cards radius 16px, 1px `border`,
padding 16–20px, 16px gap between cards, plus a subtle `shadow-sm` lift (a
sheet of paper sitting just off the page). Buttons: radius 12px, min height
48px, full-width on mobile for the main action. Chips: radius 6px. Badges
("stamps"): radius 999px, now with a variant-specific ring — see below.
Spacing on a 4px grid.

### Passport textures (decorative, used sparingly)

Defined once in `globals.css`, always `aria-hidden`/purely decorative, and
layered *behind* text so they can never reduce contrast:

- **`.bg-guilloche`** — a faint two-directional engraved-line wash (two
  `repeating-linear-gradient`s in `border` at 16–22% opacity). Applied to the
  top bar and the attention banner only — not to every card, so it stays a
  texture rather than wallpaper.
- **`.perforated-divider`** — a dashed 1px rule (`repeating-linear-gradient`
  in `border`) standing in for a passport leaf's perforated edge. Used
  between "Agreed dates" and "Proposed change" in the Event brief / stay
  detail card.

## Components (as seen)

- **Top bar** — unchanged layout: left, the app icon + "Lyanne Visa" in the
  display serif with a caret that opens the drawer; right, avatar circle,
  name, underlined "Sign out", and the light/dark switch. Now carries a
  faint `.bg-guilloche` wash.
- **Navigation drawer** — unchanged: slides from the left over a dimmed
  page; current page filled `accent`/`accent-ink`, others outlined `border`;
  "Sign out" pinned at the bottom.
- **Greeting** — "Hi {name}" in Besley at the top of Overview/HostHome.
- **Attention banner** — `attention-bg` with a 4px `attention` left bar, the
  faint guilloche wash, a serif title, one plain sentence. Shown only when
  something is waiting on the viewer.
- **Month calendar** — unchanged structure: card with serif month title
  between square outlined ‹ › buttons; weekday row in `muted`; confirmed days
  = `confirmed-bg` tile with ✓; not-agreed days = dashed `attention` outline
  with "?"; the open stay's days get an `accent` ring. Legend below.
- **Status badge ("stamp")** — pill, icon-in-a-circle + label, never colour
  alone. `confirmed` now reads as a solid **double-ring** stamp
  (`border-2 border-double`, like an ink approval stamp); `attention` reads
  as a **dashed** pending stamp (not yet inked in); `danger`/`neutral` keep a
  plain single ring. Label text stays normal case — legibility for
  grandparents outranks the passport conceit.
- **Event brief / Application detail** — same structure as the shared
  foundation (status banner → dates card → actions → history timeline →
  confirm dialog). Dates are set in Besley with `tracking-wide` for a
  printed-entry feel; when both an agreed date and a proposed change are
  shown together, a `.perforated-divider` separates them instead of a plain
  rule.
- **Cards** — `surface` fill, `border` outline, 16px radius, now with a
  subtle `shadow-sm` lift.
- **Buttons** — unchanged roles (primary filled `accent`/`accent-ink`,
  secondary outlined `border`, destructive `danger` text on outline filled
  only inside the confirm dialog, quiet/links `accent` underlined); colours
  now read as terracotta ink rather than periwinkle-blue.

## Applying it to every screen

All screens (`SignIn`, `Register`, `Waiting`, `Deactivated`, `ParentHome`,
`HostHome`, `AdminAccounts`, `AdminChildren`, `AdminHomes`,
`AdminDeliveries`, `Overview`, `Applications`, `PlanStay`,
`ApplicationDetail`) are built from the shared components above — `Card`,
`Badge`, `Banner`, `Button`, `TextField`/`Select`/`Textarea`/
`DateRangePicker`, `Collapsible`, `ConfirmDialog`, `InfoTip`, `Chip` — and
picked up this variant's palette, type and stamp/texture treatment
automatically through the shared CSS tokens, with no per-screen prop or
copy changes. `ApplicationDetail` and `Overview` got the two targeted
additions above (tracked-out dates, the perforated divider) since they're
where dates and stamps matter most.
