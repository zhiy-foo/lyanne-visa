# Tasks

## 1. Endpoint and schedule

- [x] 1.1 `src/app/api/keepalive/route.ts` `GET`: 401 unless `Authorization` equals `Bearer ${CRON_SECRET}` (CRON_SECRET unset/empty always 401), one head select via `createClient()`, 200 `{ok:true}` / 500; verify: unit tests for missing/wrong header, unset secret, success, expected permission refusal, other Supabase error, thrown error
- [x] 1.2 `vercel.json` `crons` entry `/api/keepalive` at `0 3 * * *`, `regions` kept; verify: JSON valid, `npm run build` passes
- [x] 1.3 `src/proxy.ts` passes `/api/keepalive` through without redirect; verify: a test that the proxy returns a non-redirect with no session

## 2. Docs

- [x] 2.1 `.env.example` and `docs/stayover/general/setup.md`: `CRON_SECRET` step, Cron Jobs check, curl test
- [x] 2.2 Reconcile ARCHITECTURE/IMPLEMENTATION/STATUS (Trn `keepalive`, Trm `t_cron`); run the drift check, 0 dead
