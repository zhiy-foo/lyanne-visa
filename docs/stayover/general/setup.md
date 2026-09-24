# Lyanne Visa — Hosted Setup Guide

Follow each section in order; you'll return to section 5 after step 7 goes live.

---

## 1. Gmail app account

- [ ] Go to [accounts.google.com/signup](https://accounts.google.com/signup)
- [ ] Create `lyanne.stayovers@gmail.com`, "For my personal use"
- [ ] Sign in and go to [myaccount.google.com/security](https://myaccount.google.com/security)
- [ ] Turn on **2-Step Verification**, add a phone number
- [ ] Open **"App passwords"** (search "App passwords" in the account search bar if you can't see it), enter the name `Supabase`, click **Create** (labels may vary slightly)
- [ ] Google generates a 16-character password — copy it to your password manager
- [ ] **Never commit or share this password**
- [ ] Repeat "App passwords" → **Create** a *second*, separate app password named `Delivery`, for the app's own outbound mail (turn notices and calendar invites) — kept distinct from the `Supabase` one above so revoking or rotating one never breaks the other → copy it to your password manager → `DELIVERY_SMTP_APP_PASSWORD` (used in steps 7-8)

---

## 2. Supabase project

- [ ] Go to [supabase.com](https://supabase.com) and sign in
- [ ] Click **"New project"**
- [ ] Pick the region closest to Singapore ("Southeast Asia (Singapore)")
- [ ] **GitHub (optional):** leave it unlinked — we apply database changes deliberately with `db push` (step 6), not automatically on every push
- [ ] **Database password:** click "Generate a password" and save it in your password manager — the app never uses it; you type it once for `npx supabase link` / `db push`
- [ ] **Security:** keep **Enable Data API** ticked; **untick** "Automatically expose new tables" (our migrations grant access explicitly); **tick** "Enable automatic RLS" (extra safety net)
- [ ] Click **Create new project** and wait ~1 minute for initialization
- [ ] Go to **Project Settings** (gear icon)
- [ ] Copy and save:
  - **Project URL** (`https://<ref>.supabase.co`, under **Integrations → Data API**, or the **Connect** button on the project home) → `NEXT_PUBLIC_SUPABASE_URL`
  - **Publishable key** (`sb_publishable_…`, under **API Keys**) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - **Project ID / ref** (under **General**) → used once in step 6
- [ ] Never copy the **Secret key** (`sb_secret_…`) or the legacy `service_role` key — the app never needs them

---

## 3. Sign-in emails via Gmail (custom SMTP)

Supabase's built-in email only reaches your team; custom SMTP lets your family receive sign-in links.

- [ ] In Supabase, go to **Authentication** → **Emails / SMTP Settings** (labels may vary)
- [ ] Toggle **"Enable Custom SMTP"** and fill:
  - **Host:** `smtp.gmail.com`
  - **Port:** `587`
  - **Username:** `lyanne.stayovers@gmail.com`
  - **Password:** (the 16-character password from step 1)
  - **Sender Email:** `lyanne.stayovers@gmail.com`
  - **Sender Name:** `Lyanne Visa`
- [ ] Save, then go to **Authentication** → **Providers** → **Email**
- [ ] Toggle **"Enable Email Provider"** and keep **"Confirm email"** on
- [ ] Save

---

## 4. Google sign-in

Google calls this area **Google Auth Platform** (it replaced the old "OAuth consent screen"; labels may vary slightly).

- [ ] Go to [console.cloud.google.com](https://console.cloud.google.com), signed in as `lyanne.stayovers@gmail.com`
- [ ] Project dropdown (top left) → **New Project** → name `lyanne-visa` → **Create**, then make sure it is selected
- [ ] Search "Google Auth Platform" (or ☰ → APIs & Services → OAuth consent screen) → **Overview** → **Get started**
- [ ] The 4-step wizard:
  1. **App Information** — App name `Lyanne Visa`, User support email `lyanne.stayovers@gmail.com` → **Next**
  2. **Audience** — choose **External** (Internal is greyed out for personal Gmail) → **Next**
  3. **Contact Information** — `lyanne.stayovers@gmail.com` → **Next**
  4. **Finish** — tick the agreement → **Continue** → **Create**
- [ ] **Data Access** (left menu) → **Add or remove scopes** → tick only `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` → **Update** → **Save**
- [ ] **Audience** (left menu) → **Add users** under *Test users* → add `lyanne.stayovers@gmail.com` and the Gmail addresses of family who will use Google sign-in → **Save**. Leave the status on **Testing** for now: Google sign-in works for listed test users (up to 100); email-link sign-in works for everyone regardless.
- [ ] *Later, once the Vercel site is live:* complete **Branding** (home page = site URL, privacy policy = `<site>/privacy`, authorised domain = the site's domain) → **Audience** → **Publish app** → **In production**, so any family Gmail can use Google sign-in without being listed
- [ ] **Clients** (left menu) → **Create client** → Application type **Web application**, name `Supabase`
- [ ] Under **Authorized redirect URIs** → **Add URI** → paste the **Callback URL** from Supabase (**Authentication → Sign In / Providers → Google**; looks like `https://<ref>.supabase.co/auth/v1/callback`) → **Create**
- [ ] Under **Authorized JavaScript origins** → **Add URI** → add `http://localhost` and `http://localhost:3000` (and later the Vercel site URL) — this is what lets Google Identity Services run on our own page instead of Supabase's redirect flow
- [ ] Copy the **Client ID** and **Client secret** into your password manager **immediately** — Google shows the full secret only once
- [ ] In Supabase (**Authentication → Sign In / Providers → Google**): switch it on, paste the Client ID and secret → **Save**
- [ ] Skip **Branding** and **Verification Center** — not needed for basic sign-in

---

## 5. Allowed redirect URLs

- [ ] In Supabase, go to **Authentication** → **URL Configuration**
- [ ] Set **"Site URL"** to `http://localhost:3000` for now (you'll change it after step 7)
- [ ] Under **"Redirect URLs"**, add:
  - `http://localhost:3000/**`
  - `https://<your-vercel-site>.vercel.app/**` (update after step 7)
- [ ] Save

---

## 6. Database schema and admin

*Do this once the app code is ready.*

1. [ ] In a terminal in the project folder run `npx supabase login`; when it says to press Enter to open the browser, press Enter and approve in the browser — the CLI creates and stores its own access token (no need to generate one by hand).
   - Alternative: supabase.com/dashboard/account/tokens → Generate token → Project access for the Lyanne Stayovers project, 7-day expiry, broadest preset for that project; paste it when `supabase login` asks.

2. [ ] `npx supabase link --project-ref <ref>` — it asks for the database password (the one saved in your password manager).

3. [ ] `npx supabase db push` — it lists the migration files and asks to confirm; type `Y`.
   - If it fails with `failed to open migration file: Unknown: FileSystem.readFile`, the Supabase CLI (v2.117 on Windows) cannot read files when the project path contains spaces. Map the folder to a drive letter and push from there: `subst L: "<full path to the lyanne-visa folder>"`, then `L:`, then `npx supabase db push`, then `C:` and `subst L: /d` to remove the mapping. Nothing is applied when this error occurs, so it is safe to retry.

4. [ ] In Supabase **SQL Editor**, run:
   ```sql
   insert into app_admin (email) values ('lyanne.stayovers@gmail.com');
   ```
   - You're now the admin

5. [ ] Check: `npx supabase migration list` shows every migration with matching local and remote versions.

6. [ ] **Delivery worker secret** (security fix — without this, `claim_pending_dispatches`/`record_dispatch_outcome` refuse every call): generate a random value, e.g. run `openssl rand -hex 32` in a terminal, or generate one in your password manager — either way, save it to your password manager as `DELIVERY_WORKER_SECRET`. In Supabase **SQL Editor**, run (replacing `<the value>` with what you just generated):
   ```sql
   insert into app_private.delivery_worker (secret_hash)
   values (encode(extensions.digest('<the value>', 'sha256'), 'hex'));
   ```
   - The table only ever holds one row — a second `insert` fails on purpose. To rotate the secret later, run this instead (note the `where true` — Supabase's hosted Postgres rejects an `update` with no `where` clause):
   ```sql
   update app_private.delivery_worker
   set secret_hash = encode(extensions.digest('<the new value>', 'sha256'), 'hex')
   where true;
   ```
   - Update `DELIVERY_WORKER_SECRET` in Vercel (step 7) and `.env.local` (step 8) to match whichever value you last hashed here — the app and the database must agree, or every delivery claim/record call fails with `not_worker`.

---

## 6a. Continuous integration

- Every pull request and every push to `main` runs `.github/workflows/ci.yml` on GitHub Actions: install, lint, typecheck, the full test suite (including `test/db`, which runs against an in-process PGlite Postgres — no Docker or live Supabase needed), then a production build.
- A red check should block merging — don't merge a PR with a failing CI run.
- To require it: GitHub → repo **Settings** → **Branches** → add a branch protection rule (or ruleset) for `main` → enable **require status checks to pass** → select the CI job (it only appears in the list after the workflow has run at least once).

---

## 7. Vercel site

- [ ] Go to [vercel.com](https://vercel.com), click **"Add New"** → **"Project"**
- [ ] Under **"Import Git Repository"**, click **GitHub** and select `zhiy-foo/lyanne-visa` (the framework preset auto-detects Next.js; leave build settings default)
- [ ] Before the first deploy, in the import screen's **"Environment Variables"** section, add the following variable names — copy values from your password manager or `.env.local`:
  - **Public** (these can have `NEXT_PUBLIC_` prefix):
    - `NEXT_PUBLIC_SUPABASE_URL` (from step 2)
    - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (from step 2)
    - `NEXT_PUBLIC_SITE_URL` (your Vercel site URL — use a placeholder for now, you'll update this after the first deploy)
    - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (from step 4)
  - **Secret** (server-only, no `NEXT_PUBLIC_` prefix):
    - `DELIVERY_SMTP_USER` → `lyanne.stayovers@gmail.com`
    - `DELIVERY_SMTP_APP_PASSWORD` (the `Delivery` app password from step 1)
    - `DELIVERY_FROM_ADDRESS` → `lyanne.stayovers@gmail.com`
    - `DELIVERY_WORKER_SECRET` (the value you generated and hashed into Supabase in step 6)
- [ ] Click **"Deploy"**, wait 2–3 minutes
- [ ] After the first deploy, note these:
  - Your production URL (shown on the Deployments page, e.g., `https://lyanne-visa-abc123.vercel.app`)
  - The app is deployed to production only if merged to the default branch (`main`); other branches get preview URLs. If your work is on `feat/foundation`, merge it to `main` first (or change the production branch in **Project → Settings → Git**)
- [ ] Update `NEXT_PUBLIC_SITE_URL` in **Project → Settings → Environment Variables** to your actual production URL (`https://<your-vercel-site>.vercel.app`), then click **Deployments → ⋯ → Redeploy** to rebuild with the updated URL
- [ ] **Go back to step 5** and update:
  - **Site URL** → your Vercel production URL
  - **Redirect URLs** → replace the template with your actual URL
- [ ] In **Google Cloud Console**, go to the **Supabase** OAuth client's **Authorized JavaScript origins** → **Add URI** → add your Vercel production URL

---

## 8. Local development

- [ ] Clone the repository to your computer
- [ ] Copy `.env.example` to `.env.local`
- [ ] Fill in:
  - `NEXT_PUBLIC_SUPABASE_URL` (from step 2)
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (from step 2)
  - `NEXT_PUBLIC_SITE_URL` = `http://localhost:3000`
  - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (from step 4, public, not a secret — restart `npm run dev` if you add or change this after it's already running, since Next.js only inlines `NEXT_PUBLIC_*` vars at startup)
  - `DELIVERY_SMTP_USER`, `DELIVERY_SMTP_APP_PASSWORD` (the `Delivery` app password from step 1), `DELIVERY_FROM_ADDRESS` — optional locally; without them, turn notices and invites just log to the console instead of sending (the console/test `Mailer` double)
  - `DELIVERY_WORKER_SECRET` — the value from step 6, if you want to exercise delivery locally against a linked Supabase project (matching what you hashed into `app_private.delivery_worker`); not needed to run the app otherwise
- [ ] Run:
  ```bash
  npm install
  npm run dev
  ```
- [ ] Open [http://localhost:3000](http://localhost:3000)

---

## 9. First run

- [ ] Sign in as `lyanne.stayovers@gmail.com` (email link or Google) — the admin does **not** register as a parent or host
- [ ] You land on the **Admin page**
- [ ] Set a **Join Code** and save — make it hard to guess (e.g. three random words like `teapot-harbour-violet`, not a year or a name); it can't be shown again, so keep it in your password manager
- [ ] Share your site link and join code with family in a private chat
- [ ] Members who enter the code become active; without it, they join a waiting list

---

## 10. Keep secret

Never commit or share these:

- Both Gmail app passwords (`Supabase` and `Delivery`, 16 characters each, from step 1)
- Google Client Secret (from step 4)
- Supabase secret key / legacy service_role key
- Family join code
- Delivery worker secret (`DELIVERY_WORKER_SECRET`, from step 6) — only its sha256 hash ever goes into the database

Your `.env.local` is git-ignored, so it's safe. The `NEXT_PUBLIC_*` values in Vercel are public keys.

---

## Troubleshooting

**Sign-in email not arriving**
- Check spam; verify SMTP settings (step 3); Gmail sends ~500/day (you won't hit this at family scale)

**`db push` fails with `FileSystem.readFile`**
- Spaces in the project path — see the note under section 6 step 3 (map the folder with `subst` and push from the drive letter)

**"redirect_uri_mismatch" from Google**
- The redirect URL must match exactly between Google Cloud and Supabase (case-sensitive, including `https://`)

**"Access denied" or "Not admin" after sign-in**
- Check the `app_admin` table in Supabase: your email must be there, lowercase
- Run the SQL from step 6 again if needed

**Delivery stuck / `not_worker` error**
- The delivery worker secret hasn't been configured yet, or `DELIVERY_WORKER_SECRET` (Vercel/`.env.local`) doesn't match the hash last inserted/rotated into `app_private.delivery_worker` — redo step 6's insert or rotate step with the same value you put in the env var
