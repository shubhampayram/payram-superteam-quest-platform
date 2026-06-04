# PayRam Quest Platform — Setup Guide

> **Zero technical knowledge required.**  
> Follow every numbered step in order. Decision points are marked **DECISION**.  
> Risky steps are marked **WARNING**.

---

## What you are setting up

| Piece | What it does |
|---|---|
| **This codebase** | Vite + React frontend + Express backend (runs as one Node.js server) |
| **Supabase** | Postgres database + file storage (for a production deployment) |
| **Resend** | Sends welcome emails to new participants |
| **Railway** | Hosts the Node.js server in the cloud (recommended) |
| **Vercel** | Alternative: host the frontend only (requires extra steps) |

> **Note:** The current app stores data in a local `server-db.json` file.  
> For local development this works perfectly.  
> For production you need a cloud server like Railway (covered in Section D).

---

## SECTION A — Run locally on your computer

### Step 1 — Install Node.js

1. Open your browser and go to **https://nodejs.org**
2. Click the big green button that says **"LTS"** (Long Term Support)
3. Download and run the installer
4. Accept all defaults, click Next → Next → Install → Finish
5. To verify: open **Terminal** (Mac) or **Command Prompt** (Windows) and type:
   ```
   node --version
   ```
   You should see something like `v20.x.x`

---

### Step 2 — Open the project folder

**On Windows:**
1. Open **File Explorer**
2. Navigate to: `C:\Users\shubh\OneDrive\Documents\Claude\Projects\Simple PayRam Quest`
3. Click the address bar at the top, type `cmd`, press Enter
4. A black Command Prompt window opens — all commands go here

**On Mac:**
1. Open **Finder**, navigate to the project folder
2. Right-click the folder → **New Terminal at Folder**

---

### Step 3 — Install dependencies

In the terminal, type exactly:
```
npm install
```
Wait until it finishes (may take 1–2 minutes). You will see a progress bar.

---

### Step 4 — Set your admin password

1. Open the file `.env` in the project folder (use Notepad or any text editor)
2. Change the line:
   ```
   ADMIN_PASSWORD=Admin@Payram2026!
   ```
   Replace `Admin@Payram2026!` with **your own strong password**  
   (use letters, numbers, and symbols — at least 12 characters)
3. Save the file

> **WARNING:** Never share this file or commit it to GitHub. It contains your admin password.

---

### Step 5 — Start the development server

In the terminal, type:
```
npm run dev
```
You will see:
```
Dev server running at http://localhost:3000
```

Open your browser and go to **http://localhost:3000**

The app is now running! To stop it, press **Ctrl + C** in the terminal.

---

### Step 6 — Log in as admin (local)

1. On the home page, click **Admin Gate Access** (top right)
2. Enter:
   - **Email:** `admin@payram.co` (or whatever you set as `ADMIN_EMAIL` in `.env`)
   - **Password:** the password you set in Step 4
3. Click **Authorize Access**

---

## SECTION B — Set up Supabase (for production database)

> Skip this section if you only want to run locally.

### Step 7 — Create a Supabase account

1. Go to **https://supabase.com**
2. Click the green **Start your project** button
3. Click **Sign up** → sign up with your GitHub or Google account
4. Confirm your email if asked

---

### Step 8 — Create a new project

1. After logging in, click the green **New project** button
2. Fill in:
   - **Name:** `payram-quest`
   - **Database Password:** click **Generate a password**, copy it somewhere safe
   - **Region:** choose the one closest to your users (e.g. `Southeast Asia (Singapore)` for India/Asia)
3. Click **Create new project**
4. Wait 1–2 minutes for the project to be ready (you'll see a spinning icon)

---

### Step 9 — Run the database schema (create tables)

1. In your Supabase project, look at the **left sidebar**
2. Click **SQL Editor** (looks like a play button icon `>`_)
3. Click **New query** (top left of the editor)
4. Open the file `supabase/schema.sql` from this project in any text editor
5. Select ALL the text (Ctrl+A / Cmd+A), copy it (Ctrl+C / Cmd+C)
6. Paste it into the Supabase SQL Editor (Ctrl+V / Cmd+V)
7. Click the green **Run** button (or press Ctrl+Enter)
8. You should see: `Success. No rows returned`

> If you see a red error message, check that you pasted the entire file content.

---

### Step 10 — Run the RLS policies SQL

The `supabase/schema.sql` file you ran in Step 9 already includes all RLS policies.  
No additional step needed — they were applied together.

To verify:
1. Click **Table Editor** in the left sidebar
2. You should see tables: `campaigns`, `tasks`, `participants`, `task_completions`, `admin_users`

---

### Step 11 — Create the screenshots storage bucket

1. In the left sidebar, click **Storage** (bucket icon)
2. Click **New bucket**
3. Fill in:
   - **Name:** `screenshots`  
   - **Public bucket:** leave this **OFF** (unchecked)
4. Click **Save**

Now set upload permissions:
5. Click on the `screenshots` bucket you just created
6. Click **Policies** tab
7. Click **New policy**
8. Click **For full customization**
9. Fill in:
   - **Policy name:** `allow_uploads`
   - **Allowed operation:** check **INSERT**
   - **Target roles:** check **anon** AND **authenticated**
   - **USING expression:** leave blank
   - **WITH CHECK expression:** `true`
10. Click **Review** → **Save policy**

Repeat steps 7–10 to add a second policy for admins to VIEW:
- **Policy name:** `admin_view_screenshots`
- **Allowed operation:** check **SELECT**
- **Target roles:** check **authenticated** only
- **USING expression:** `true`
- Click **Review** → **Save policy**

---

### Step 12 — Create your admin account in Supabase

1. In the left sidebar, click **Authentication** (person icon)
2. Click **Users** tab
3. Click the **Invite user** button (or **Add user**)
4. Enter:
   - **Email:** `admin@payram.co` (or your preferred admin email)
   - **Password:** your strong admin password
5. Click **Create user**
6. Copy the **User UID** shown in the users list (looks like: `a1b2c3d4-...`)

Now register this user as an admin in the database:
7. Click **SQL Editor** → **New query**
8. Paste this, replacing the values:
   ```sql
   INSERT INTO admin_users (id, email)
   VALUES ('PASTE-YOUR-USER-UID-HERE', 'admin@payram.co');
   ```
9. Click **Run**

---

### Step 13 — Get your Supabase connection keys

1. In the left sidebar, click **Project Settings** (gear icon ⚙️)
2. Click **API** under the Configuration section
3. You will see:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon / public key** — a long string starting with `eyJ...`
   - **service_role key** — another long string (keep this secret!)

Copy both keys — you will need them in Section D.

---

## SECTION C — Set up Resend (welcome emails)

> Skip this section if you don't want welcome emails.

### Step 14 — Create a Resend account

1. Go to **https://resend.com**
2. Click **Get started for free**
3. Sign up with your email
4. Confirm your email address

---

### Step 15 — Get your Resend API key

1. After logging in, click **API Keys** in the left sidebar
2. Click **Create API Key**
3. Give it a name: `payram-quest`
4. Click **Add**
5. **COPY THE KEY NOW** — it starts with `re_` and is only shown once
6. Paste it somewhere safe

---

### Step 16 — Add your sending domain (or use sandbox)

**DECISION:** Do you have a domain name (e.g. `payram.co`)?  

- **YES** → Click **Domains** in Resend sidebar → Add Domain → follow the instructions to add DNS records
- **NO** → You can use the sandbox for testing. Emails will only send to your own registered email address. The `from` address `onboarding@resend.dev` is already set up in the code and works in sandbox mode.

---

## SECTION D — Deploy to Railway (recommended)

Railway hosts your Node.js server in the cloud. It persists your data and runs 24/7.

### Step 17 — Create a Railway account

1. Go to **https://railway.app**
2. Click **Login** → log in with your GitHub account
3. If you don't have GitHub: go to **https://github.com** → Sign up → then come back

---

### Step 18 — Push your code to GitHub

1. Go to **https://github.com/new**
2. Create a new repository:
   - **Repository name:** `payram-quest`
   - **Visibility:** Private (recommended)
   - Do NOT check any initialization options
3. Click **Create repository**
4. GitHub shows you instructions. Open your terminal in the project folder and run these commands one at a time:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/payram-quest.git
   git push -u origin main
   ```
   Replace `YOUR-USERNAME` with your GitHub username.

> **WARNING:** Before pushing, make sure `.env` is NOT in your commit. The `.gitignore` file already excludes it — double check by running `git status` and confirming you do NOT see `.env` in the list.

---

### Step 19 — Deploy on Railway

1. Go to **https://railway.app/dashboard**
2. Click **New Project**
3. Click **Deploy from GitHub repo**
4. Select your `payram-quest` repository
5. Click **Deploy Now**

Railway will automatically detect it's a Node.js app and start building.

---

### Step 20 — Set environment variables on Railway

1. In your Railway project, click on the service (the box that appeared)
2. Click the **Variables** tab
3. Click **New Variable** for each of the following:

| Variable Name | Value | Where to find it |
|---|---|---|
| `NODE_ENV` | `production` | Type it manually |
| `ADMIN_EMAIL` | `admin@payram.co` | Your admin email |
| `ADMIN_PASSWORD` | your strong password | The password you chose |
| `RESEND_API_KEY` | `re_xxxxx...` | From Resend Step 15 |
| `APP_URL` | your Railway URL | See Step 21 below |

4. After adding all variables, click **Deploy** (or Railway redeploys automatically)

---

### Step 21 — Get your Railway URL

1. Click the **Settings** tab in your Railway service
2. Under **Networking**, click **Generate Domain**
3. Copy the URL — it looks like `https://payram-quest-production.up.railway.app`
4. Go back to **Variables** tab and set `APP_URL` to this URL

---

## SECTION E — Deploy to Vercel (frontend only, advanced)

> Use this ONLY if you want to host on Vercel specifically.  
> This requires deploying the Express backend separately on Railway first (Steps 17–21 above).

**DECISION:** Are you OK with Railway for hosting?  
→ If YES, skip this section. Railway already handles everything.  
→ If NO and you specifically need Vercel, continue below.

### Step 22 — Create a Vercel account

1. Go to **https://vercel.com**
2. Click **Sign up** → sign up with GitHub

---

### Step 23 — Import project to Vercel

1. Click **Add New → Project**
2. Click **Import** next to your `payram-quest` repository
3. Under **Framework Preset**, select **Vite**
4. Under **Build Command**, type: `vite build`
5. Under **Output Directory**, type: `dist`
6. Click **Deploy**

---

### Step 24 — Set environment variables on Vercel

1. Go to your project in Vercel
2. Click **Settings** tab → **Environment Variables**
3. Add these (same as Railway table above)

---

### Step 25 — Set custom domain on Vercel

1. In Vercel project → **Settings** → **Domains**
2. Click **Add Domain**
3. Type: `platform.payram.com`
4. Click **Add**
5. Vercel will show you two DNS records to add

Add those DNS records:
6. Log in to wherever you bought your domain (Namecheap, GoDaddy, Cloudflare, etc.)
7. Find **DNS Settings** or **DNS Management**
8. Add the records Vercel shows you:
   - Usually one **A record** pointing to `76.76.21.21`
   - And/or one **CNAME record** pointing to `cname.vercel-dns.com`
9. Save and wait up to 24 hours for DNS to propagate (usually under 1 hour)

**Verify:** Vercel will show a green checkmark ✓ when the domain is active.

---

## SECTION F — End-to-end test checklist

### Step 26 — Test as a participant

Open your app URL and verify each of these works:

- [ ] **Home page loads** — you see the PayRam Quest Hub hero section
- [ ] **Theme toggle** — clicking the sun/moon button switches between dark and light mode
- [ ] **Registration** — fill in username, email, country, click Enter Platform
- [ ] **Campaigns load** — you see at least one campaign card
- [ ] **Tasks load** — clicking View Tasks shows the task list
- [ ] **LLM task** — clicking "Open in ChatGPT →" opens a new browser tab with the prompt pre-filled
- [ ] **Screenshot upload** — the proof modal opens, drag-drop or file select works, 5MB+ file shows an error
- [ ] **Blog task** — pasting an https:// URL and clicking Submit Blog URL marks the task done
- [ ] **Completion banner** — after all tasks done, a green banner appears with the Superteam link
- [ ] **Page refresh** — refreshing the page keeps you logged in (participant session restored)

---

### Step 27 — Test as an admin

- [ ] **Admin login** — click Admin Gate Access → enter credentials → dashboard loads
- [ ] **Stats cards** — Total Participants, Completions, Flagged, Active Campaigns all show numbers
- [ ] **7-day chart** — bar chart renders without errors
- [ ] **Create campaign** — Campaigns tab → Create Campaign → fill in form → Save Campaign → appears in list
- [ ] **Add task to campaign** — View Tasks → Add Quest Task → create an LLM Search task → LLM URL preview updates live
- [ ] **Toggle campaign status** — click the Active/Disabled toggle → status changes immediately
- [ ] **Flag a submission** — Submissions tab → View Proof → Flag Submission → enter reason → Confirm Flag → badge turns red
- [ ] **Unflag** — View Proof on a flagged submission → Approve Submission → badge turns green
- [ ] **Export CSV** — Export CSV button downloads a `.csv` file with today's date in the filename
- [ ] **Admin logout** — clicking Logout returns to admin login screen

---

### Step 28 — Common issues and fixes

| Problem | Fix |
|---|---|
| Server starts but `/api/admin/login` returns 500 | Set `ADMIN_PASSWORD` in your `.env` file |
| Admin login shows "Invalid credentials" | Make sure email + password match exactly what's in `.env` |
| Screenshots not saving | Check that the `uploads/` folder exists in the project root |
| Emails not sending | Set a valid `RESEND_API_KEY` in `.env`. If blank, emails only log to console |
| "Participant not found" on refresh | Participant ID in localStorage is stale — click "Not you?" to log out and re-enter |
| Railway build fails | Make sure `package.json` has a `"start": "node dist/server.cjs"` script (it does) |
| Vercel shows blank page | Check that Build Command is `vite build` and Output Directory is `dist` |

---

## Environment variables reference

Complete list of all environment variables:

| Variable | Required | Description |
|---|---|---|
| `ADMIN_EMAIL` | ✅ Yes | Email address for admin login |
| `ADMIN_PASSWORD` | ✅ Yes | Password for admin login (must be set or server returns 500) |
| `RESEND_API_KEY` | ❌ Optional | Resend API key for welcome emails. If blank, emails log to console only |
| `APP_URL` | ❌ Optional | Full URL of the app, used in email links (e.g. `https://your-app.railway.app`) |
| `NODE_ENV` | ❌ Optional | Set to `production` when deploying. Omit for local dev |
