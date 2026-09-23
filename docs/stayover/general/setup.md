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
- [ ] *Later, once the Netlify site is live:* complete **Branding** (home page = site URL, privacy policy = `<site>/privacy`, authorised domain = the site's domain) → **Audience** → **Publish app** → **In production**, so any family Gmail can use Google sign-in without being listed
- [ ] **Clients** (left menu) → **Create client** → Application type **Web application**, name `Supabase`
- [ ] Under **Authorized redirect URIs** → **Add URI** → paste the **Callback URL** from Supabase (**Authentication → Sign In / Providers → Google**; looks like `https://<ref>.supabase.co/auth/v1/callback`) → **Create**
- [ ] Copy the **Client ID** and **Client secret** into your password manager **immediately** — Google shows the full secret only once
- [ ] In Supabase (**Authentication → Sign In / Providers → Google**): switch it on, paste the Client ID and secret → **Save**
- [ ] Skip **Branding** and **Verification Center** — not needed for basic sign-in

---

## 5. Allowed redirect URLs

- [ ] In Supabase, go to **Authentication** → **URL Configuration**
- [ ] Set **"Site URL"** to `http://localhost:3000` for now (you'll change it after step 7)
- [ ] Under **"Redirect URLs"**, add:
  - `http://localhost:3000/**`
  - `https://<your-netlify-site>.netlify.app/**` (update after step 7)
- [ ] Save

---

## 6. Database schema and admin

*Do this once the app code is ready.*

- [ ] In your terminal (project root):
  ```bash
  npx supabase login
  ```
  - Create a token at [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens), paste it when prompted
- [ ] Link your project (replace `<ref>` with your Project Ref):
  ```bash
  npx supabase link --project-ref <ref>
  npx supabase db push
  ```
- [ ] In Supabase **SQL Editor**, run:
  ```sql
  insert into app_admin (email) values ('lyanne.stayovers@gmail.com');
  ```
- [ ] You're now the admin

---

## 7. Netlify site

- [ ] Go to [netlify.com](https://netlify.com), click **"Add new site"** → **"Import an existing project"**
- [ ] Connect GitHub, select `zhiy-foo/lyanne-visa`
- [ ] **Build command:** `npm run build`
- [ ] Add environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL` → (from step 2)
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → (from step 2)
  - `NEXT_PUBLIC_SITE_URL` → (your Netlify site URL, shown after deploy)
- [ ] Click **"Deploy site"**, wait 3–5 minutes
- [ ] Copy your site URL (e.g., `https://lyanne-visa-abc123.netlify.app`)
- [ ] **Go back to step 5** and update:
  - **Site URL** → your site URL
  - **Redirect URLs** → replace the template with your actual site URL

---

## 8. Local development

- [ ] Clone the repository to your computer
- [ ] Copy `.env.example` to `.env.local`
- [ ] Fill in:
  - `NEXT_PUBLIC_SUPABASE_URL` (from step 2)
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (from step 2)
  - `NEXT_PUBLIC_SITE_URL` = `http://localhost:3000`
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

- Gmail app password (16 characters from step 1)
- Google Client Secret (from step 4)
- Supabase secret key / legacy service_role key
- Family join code

Your `.env.local` is git-ignored, so it's safe. The `NEXT_PUBLIC_*` values in Netlify are public keys.

---

## Troubleshooting

**Sign-in email not arriving**
- Check spam; verify SMTP settings (step 3); Gmail sends ~500/day (you won't hit this at family scale)

**"redirect_uri_mismatch" from Google**
- The redirect URL must match exactly between Google Cloud and Supabase (case-sensitive, including `https://`)

**"Access denied" or "Not admin" after sign-in**
- Check the `app_admin` table in Supabase: your email must be there, lowercase
- Run the SQL from step 6 again if needed
