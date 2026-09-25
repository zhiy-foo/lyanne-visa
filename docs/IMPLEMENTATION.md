# System implementation map

> Whole-system functor architecture-map.md → code, deduced from the component
> IMPLEMENTATION.md files. System-level rows only.

## Components → code root

| Component | Code root | Model | Code map |
| --- | --- | --- | --- |
| Stayover | `src/stayover/`, `src/app/`, `src/ui/`, `supabase/migrations/` | [stayover/ARCHITECTURE.md](stayover/ARCHITECTURE.md) | [stayover/IMPLEMENTATION.md](stayover/IMPLEMENTATION.md) |
| Delivery | `src/delivery/` | [delivery/ARCHITECTURE.md](delivery/ARCHITECTURE.md) | [delivery/IMPLEMENTATION.md](delivery/IMPLEMENTATION.md) |

## Shared objects (one Dat, DataLocs in ≥2 components)

| Object | Authoritative at | Also read by | Realised at | State |
| --- | --- | --- | --- | --- |
| `Member` | Stayover | Delivery | `src/stayover/` | planned |
| `Application` | Stayover | Delivery | `src/stayover/` | planned |

## Inter-component transmissions / ports (Trm)

| Port | carries | c_from → c_to | Realising code | State |
| --- | --- | --- | --- | --- |
| `t_stayover_event` | `StayoverEvent = MoveCommitted ⊕ ApplicationDeleted ⊕ MemberWaiting` | Stayover → Delivery | `src/delivery/` | planned |
| `participants` | `Member*` (deduced) | Stayover → Delivery | `src/stayover/` | planned |
| `calendarFacts` | `(agreed?, revision, phase, p_tz, p_address?, c_name, p_name)` | Stayover → Delivery | `src/stayover/` | planned |
| `Mailer` | `EmailMessage → SendResult ⊸` | Delivery → MailProvider (Gmail SMTP) | `src/delivery/` | planned |

## System entry points

Every request first passes through the proxy (Next 16's "run code before a route
renders" file — replaces `middleware.js`), then the matching route below. Route
list is `npm run build`'s own output (`ƒ` dynamic / `○` static).

| Entry | Trn triggered | Code |
| --- | --- | --- |
| Proxy (every request except `_next/static`, `_next/image`, `favicon.ico`) | `routeFor` / `routeForAccountUnavailable` | `src/proxy.ts:proxy` |
| `ƒ /` | `routeFor` (defense in depth) | `src/app/page.tsx:RootPage` |
| `○ /_not-found` | — (Next.js built-in) | — |
| `ƒ /admin` | redirects to `/admin/accounts` | `src/app/admin/page.tsx:AdminPage` |
| `ƒ /admin/accounts` | `render` (AdminAccounts), `approve`/`decline`/`deactivate`/`reactivate`/`setRole`/`setJoinCode` | `src/app/admin/accounts/page.tsx:AdminAccountsPage` |
| `ƒ /admin/children` | `render` (AdminChildren), `linkGuardian`/`renameChild` | `src/app/admin/children/page.tsx:AdminChildrenPage` |
| `ƒ /admin/homes` | `render` (AdminHomes), `linkHost`/`updateHome` | `src/app/admin/homes/page.tsx:AdminHomesPage` |
| `ƒ /auth/callback` | Supabase Auth code exchange, then `resolveDestination` | `src/app/auth/callback/route.ts:GET` |
| `ƒ /deactivated` | `render` (Deactivated) | `src/app/deactivated/page.tsx:DeactivatedPage` |
| `○ /dev/gallery` | dev-only screen gallery (not part of the routed app) | `src/app/dev/gallery/page.tsx` |
| `ƒ /dev/gallery/[screen]` | dev-only screen gallery | `src/app/dev/gallery/[screen]/page.tsx` |
| `ƒ /home` | `render` (ParentHome/HostHome), `addChild`/`addPlace`/`linkGuardian`/`linkHost` | `src/app/home/page.tsx:HomePage` |
| `○ /privacy` | static — public, no data fetching | `src/app/privacy/page.tsx:PrivacyPage` |
| `ƒ /register` | `register ⊸` | `src/app/register/page.tsx:RegisterPage` |
| `ƒ /sign-in` | `requestSignInLink`, Google OAuth redirect | `src/app/sign-in/page.tsx:SignInPage` |
| `ƒ /waiting` | `render` (Waiting) | `src/app/waiting/page.tsx:WaitingPage` |

`Application`'s HTTP surface (rules 2–9, 13) is not built — greenfield for that
part of the model.

## Divergences (system-level)

None yet — greenfield model phase.
