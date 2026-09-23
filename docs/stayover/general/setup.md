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
- [ ] Pick the region closest to Singapore
- [ ] Wait ~1 minute for initialization
- [ ] Go to **Project Settings** → **"API"**
- [ ] Copy and save:
  - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
  - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Never use the `service_role` key in the app

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

- [ ] Go to [console.cloud.google.com](https://console.cloud.google.com), signed in as `lyanne.stayovers@gmail.com`
- [ ] Click **Project dropdown** (top left) → **"New Project"**
- [ ] Name it `lyanne-visa`, click **"Create"**
- [ ] Go to **APIs & Services** → **OAuth consent screen**
- [ ] Choose **External**, fill:
  - **App name:** `Lyanne Visa`
  - **User support email:** `lyanne.stayovers@gmail.com`
- [ ] Click **"Add or remove scopes"**, add these three only:
  - `openid`
  - `.../auth/userinfo.email`
  - `.../auth/userinfo.profile`
- [ ] Save, then **"Publish App"** (sets status to "In production")
- [ ] Go to **APIs & Services** → **Credentials** → **"Create Credentials"** → **"OAuth Client ID"**
- [ ] Choose **"Web application"**
- [ ] Click **"Add URI"** under redirect URIs
- [ ] In Supabase (**Authentication** → **Providers** → **Google**), copy the **Redirect URL** and paste it into Google
- [ ] Google shows **Client ID** and **Client Secret** — save both safely
- [ ] Paste them into Supabase's Google provider and enable it
- [ ] Save

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
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → (from step 2)
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
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from step 2)
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
- Supabase service_role key
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
