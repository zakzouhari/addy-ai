# SmartMail AI — Deployment Guide (Free Tier)

**For: Zak Zouhari**
**Goal: Get SmartMail AI live on the internet, accessible only to your team, at zero cost.**

---

## What You're Deploying

SmartMail AI has 3 pieces that need to go live:

| Piece | What It Does | Where It Goes |
|-------|-------------|---------------|
| **API Server** | The brain — handles AI, auth, database | Render.com (free) |
| **Web Dashboard** | The website you log into | Vercel.com (free) |
| **Chrome Extension** | The toolbar inside Gmail | Your Chrome browser (free) |

You also need 2 supporting services:

| Service | What It Does | Where |
|---------|-------------|-------|
| **PostgreSQL Database** | Stores users, docs, settings | Neon.tech (free) |
| **Redis Cache** | Speeds things up | Upstash.com (free) |

---

## Accounts You Need

You said you already have: Anthropic API, Google Cloud, Cloudflare.

You still need to create free accounts at:
1. **GitHub** (github.com) — to store the code
2. **Neon** (neon.tech) — free PostgreSQL database
3. **Upstash** (upstash.com) — free Redis cache
4. **Render** (render.com) — free API hosting
5. **Vercel** (vercel.com) — free dashboard hosting

All of these have free tiers. No credit card required for the basics.

---

## STEP-BY-STEP INSTRUCTIONS

### PHASE 1: Push Your Code to GitHub

**Why:** Render and Vercel both deploy from GitHub. Your code needs to be there first.

1. Go to **github.com** and sign in (or create a free account)
2. Click the **+** icon (top right) → **New repository**
3. Name it: `smartmail-ai`
4. Set it to **Private** (important — your code has config files)
5. Click **Create repository**
6. GitHub will show you instructions. You need to run these commands on your computer in Terminal (Mac) or Command Prompt (Windows):

```
cd "path/to/your/Addy AI folder"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/smartmail-ai.git
git push -u origin main
```

**Tip for Claude in Chrome:** Tell Claude: "Go to github.com, create a new private repository called smartmail-ai, then guide me through pushing my local code to it."

---

### PHASE 2: Set Up the Database (Neon)

**Why:** SmartMail AI stores user accounts, documents, and settings in a PostgreSQL database.

1. Go to **neon.tech** and sign up (free, use your Google account)
2. Click **Create Project**
3. Name it: `smartmail`
4. Region: Choose the one closest to you
5. Click **Create Project**
6. Neon will show you a **connection string** that looks like:
   ```
   postgresql://neondb_owner:xxxxx@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
7. **COPY THIS AND SAVE IT** — you'll need it in Phase 4. This is your `DATABASE_URL`.

8. **Enable pgvector extension:** In the Neon dashboard, go to **SQL Editor** and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

**Tip for Claude in Chrome:** Tell Claude: "Go to neon.tech, create a free project called smartmail, and get me the connection string. Then run 'CREATE EXTENSION IF NOT EXISTS vector;' in the SQL editor."

---

### PHASE 3: Set Up Redis Cache (Upstash)

**Why:** Redis makes the app faster by caching frequent requests.

1. Go to **upstash.com** and sign up (free, use your Google account)
2. Click **Create Database**
3. Name: `smartmail-redis`
4. Region: Same region as your Neon database
5. Click **Create**
6. You'll see a **Redis URL** that looks like:
   ```
   rediss://default:xxxxx@us1-xxxxx.upstash.io:6379
   ```
7. **COPY THIS AND SAVE IT** — this is your `REDIS_URL`.

**Tip for Claude in Chrome:** Tell Claude: "Go to upstash.com, create a free Redis database called smartmail-redis, and get me the connection URL."

---

### PHASE 4: Set Up Google OAuth (Google Cloud Console)

**Why:** This lets people sign in with their Google account.

1. Go to **console.cloud.google.com**
2. Select or create a project (name it `SmartMail AI`)
3. Go to **APIs & Services** → **OAuth consent screen**
   - User Type: **External**
   - App name: `SmartMail AI`
   - Support email: your email
   - Add your email as a test user
   - Click Save
4. Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth 2.0 Client IDs**
   - Application type: **Web application**
   - Name: `SmartMail Web`
   - Authorized redirect URIs: (leave blank for now — you'll add the Render URL in Phase 5)
   - Click Create
5. **COPY the Client ID and Client Secret** — save these.
6. Go to **APIs & Services** → **Library**
   - Search for **Gmail API** and click **Enable**

**Tip for Claude in Chrome:** Tell Claude: "Go to Google Cloud Console, set up OAuth 2.0 credentials for a web app called SmartMail AI, enable the Gmail API, and give me the client ID and client secret."

---

### PHASE 5: Deploy the API Server (Render)

**Why:** This is the main backend that powers everything.

1. Go to **render.com** and sign up (use your GitHub account — this links them)
2. Click **New** → **Web Service**
3. Connect your **smartmail-ai** GitHub repository
4. Configure:
   - **Name:** `smartmail-api`
   - **Root Directory:** *(leave blank — do NOT set this)*
   - **Runtime:** Node
   - **Build Command:** `npm install && cd shared && npm run build && cd ../api && npx prisma generate && npm run build`
   - **Start Command:** `cd api && npx prisma migrate deploy && node dist/index.js`
   - **Instance Type:** Free
5. Click **Advanced** → **Add Environment Variables** and add ALL of these:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `API_PORT` | `3001` |
| `DATABASE_URL` | *(paste your Neon connection string from Phase 2)* |
| `REDIS_URL` | *(paste your Upstash URL from Phase 3)* |
| `ANTHROPIC_API_KEY` | *(your Anthropic API key from console.anthropic.com)* |
| `GOOGLE_CLIENT_ID` | *(from Phase 4)* |
| `GOOGLE_CLIENT_SECRET` | *(from Phase 4)* |
| `GOOGLE_REDIRECT_URI` | `https://smartmail-api.onrender.com/api/v1/auth/google/callback` |
| `DASHBOARD_URL` | *(leave blank for now — you'll fill this after Phase 6)* |
| `JWT_SECRET` | *(type any random long string, like: `mySuper5ecretKey2024xyz!abc`)* |
| `JWT_REFRESH_SECRET` | *(type another random long string, different from above)* |
| `ENCRYPTION_KEY` | *(type exactly 32 characters of letters and numbers)* |
| `VOYAGE_API_KEY` | *(optional — skip if you don't have one, knowledge base won't work)* |
| `SMTP2GO_API_KEY` | *(your SMTP2Go API key)* |
| `SMTP2GO_SENDER_EMAIL` | `zzouhari@rmchomemortgage.com` |
| `SMTP2GO_SENDER_NAME` | `Zak Zouhari` |
| `ALLOWED_EMAILS` | `zakzouhari@gmail.com,friend1@gmail.com,friend2@company.com` |
| `STRIPE_SECRET_KEY` | *(leave empty for now)* |
| `STRIPE_WEBHOOK_SECRET` | *(leave empty for now)* |
| `STRIPE_PRO_PRICE_ID` | *(leave empty for now)* |

6. Click **Create Web Service**
7. Wait for it to deploy (takes 3-5 minutes)
8. Once deployed, your API URL will be something like: `https://smartmail-api.onrender.com`
9. **COPY THIS URL** — you need it for the next steps

**IMPORTANT:** After you have the Render URL:
- Go back to **Google Cloud Console** → Credentials → Your OAuth client
- Add this as an **Authorized redirect URI:**
  `https://smartmail-api.onrender.com/api/v1/auth/google/callback`
- Update the `GOOGLE_REDIRECT_URI` env var in Render to match

**Tip for Claude in Chrome:** Tell Claude: "Go to render.com, create a new web service from my smartmail-ai GitHub repo. The root directory is 'api'. Set it up as a Node free tier. Then I need to add these environment variables: [paste the table above with your real values filled in]."

---

### PHASE 6: Deploy the Dashboard (Vercel)

**Why:** This is the website your team will actually visit and use.

1. Go to **vercel.com** and sign up (use your GitHub account)
2. Click **Add New** → **Project**
3. Import your **smartmail-ai** repository
4. Configure:
   - **Root Directory:** Click "Edit" and type `dashboard`
   - **Framework Preset:** Next.js (should auto-detect)
5. Click **Environment Variables** and add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://smartmail-api.onrender.com/api/v1` |

   *(Replace `smartmail-api.onrender.com` with your actual Render URL from Phase 5)*

6. Click **Deploy**
7. Wait for it to build (2-3 minutes)
8. Vercel will give you a URL like: `https://smartmail-ai.vercel.app`
9. **COPY THIS URL**

**NOW GO BACK TO RENDER** and update the `DASHBOARD_URL` environment variable to this Vercel URL (e.g., `https://smartmail-ai.vercel.app`).

**Tip for Claude in Chrome:** Tell Claude: "Go to vercel.com, import my smartmail-ai repo, set the root directory to 'dashboard', add the environment variable NEXT_PUBLIC_API_URL with value https://smartmail-api.onrender.com/api/v1, and deploy it."

---

### PHASE 7: Load the Chrome Extension (Local)

**Why:** This adds SmartMail AI tools directly into your Gmail.

The Chrome Extension connects to your live API. You need to build it first.

1. On your computer, open a Terminal/Command Prompt
2. Navigate to your project folder:
   ```
   cd "path/to/your/Addy AI folder"
   ```
3. Open the file `extension/src/utils/api.ts` and change the API URL from `localhost` to your Render URL:
   - Change `http://localhost:3001` to `https://smartmail-api.onrender.com`
4. Build the extension:
   ```
   cd extension
   npm install
   npm run build
   ```
5. Open Chrome and go to: `chrome://extensions/`
6. Enable **Developer mode** (toggle in top right)
7. Click **Load unpacked**
8. Select the `extension/build/` folder
9. The SmartMail AI icon should appear in your Chrome toolbar

**Tip for Claude in Chrome:** Tell Claude: "Help me update the extension API URL and build the Chrome extension for SmartMail AI."

---

### PHASE 8: Test Everything

1. Go to your Vercel dashboard URL (e.g., `https://smartmail-ai.vercel.app`)
2. Try **Sign in with Google** using your Google account (zakzouhari@gmail.com)
3. You should land on the dashboard
4. Sign out, then try creating an account with **email + password** to test that flow too
5. Open Gmail — you should see the SmartMail AI toolbar in compose windows

If something doesn't work, check:
- Render logs (render.com → your service → Logs)
- Browser console (F12 → Console tab)
- That all environment variables are correctly set

---

## HOW TO ADD TEAM MEMBERS

Team members can sign in with **Google** or **email + password**. Their email must be in the allowed list.

**Step 1: Add their email to the allowed list**
1. Go to **render.com** → your `smartmail-api` service → **Environment**
2. Find `ALLOWED_EMAILS`
3. Add their email address to the comma-separated list (any email works, not just Gmail):
   ```
   zakzouhari@gmail.com,alice@company.com,bob@outlook.com
   ```
4. Click **Save Changes** (the service will automatically restart)

**Step 2: Share the login link**
Send them your Vercel URL (e.g., `https://smartmail-ai.vercel.app`). They can either:
- Click **Sign in with Google** (if they use Gmail/Google Workspace)
- Click **Create one** to register with any email + password

## HOW EMAIL SENDING WORKS

When the app sends emails to customers, they go through **SMTP2Go** and appear as coming from `zzouhari@rmchomemortgage.com`. This is configured via the `SMTP2GO_*` environment variables in Render.

To change the sender name/email, update `SMTP2GO_SENDER_EMAIL` and `SMTP2GO_SENDER_NAME` in Render.

---

## COSTS BREAKDOWN

| Service | Free Tier Limits | Monthly Cost |
|---------|-----------------|-------------|
| Render (API) | 750 hours/month, sleeps after 15 min inactive | $0 |
| Vercel (Dashboard) | 100GB bandwidth, serverless | $0 |
| Neon (Database) | 0.5 GB storage, 1 project | $0 |
| Upstash (Redis) | 10,000 commands/day | $0 |
| Anthropic (AI) | Pay per use (~$0.003-0.015 per email) | ~$1-5/month |
| Google Cloud (OAuth) | Free for OAuth | $0 |
| SMTP2Go | Free: 1,000 emails/month | $0 |
| **Total** | | **~$1-5/month** (just AI usage) |

**Note about Render free tier:** Your API will "sleep" after 15 minutes of no activity. The first request after sleep takes ~30-60 seconds to wake up. This is normal for free tier. If this bothers you, Render's paid tier ($7/month) keeps it always on.

---

## WHAT EACH PIECE DOES (SIMPLE VERSION)

```
You open Gmail
    ↓
Chrome Extension sees Gmail and adds SmartMail buttons
    ↓
You click "Compose with AI" and type a topic
    ↓
Extension sends your request to the API Server (on Render)
    ↓
API Server calls Claude AI (Anthropic) to write the email
    ↓
Claude sends back the draft
    ↓
API Server sends it to your Extension
    ↓
Draft appears in your Gmail compose window
    ↓
You click "Send" → API sends email via SMTP2Go
    ↓
Customer receives email from zzouhari@rmchomemortgage.com
```

The Dashboard (on Vercel) is where you manage settings, view analytics, upload knowledge documents, and control your account.

---

## TROUBLESHOOTING

**"Sign in doesn't work"**
- Check Google Cloud Console → OAuth consent screen → make sure your email is listed as a test user
- Check that `GOOGLE_REDIRECT_URI` in Render matches what's in Google Cloud Credentials

**"Page loads but shows errors"**
- Check Render dashboard → Logs to see what went wrong
- Make sure `DASHBOARD_URL` in Render points to your Vercel URL
- Make sure `NEXT_PUBLIC_API_URL` in Vercel points to your Render URL + `/api/v1`

**"Extension doesn't show up in Gmail"**
- Make sure you built the extension (`npm run build` in the extension folder)
- Make sure Developer mode is on in `chrome://extensions/`
- Refresh Gmail after loading the extension

**"Access denied when signing in"**
- Check `ALLOWED_EMAILS` in Render — your email must be listed
- Emails are case-insensitive but must match exactly

---

## QUICK REFERENCE — ALL YOUR URLS

Fill these in as you complete each phase:

| What | URL |
|------|-----|
| GitHub Repo | `https://github.com/________/smartmail-ai` |
| Neon Database | `https://console.neon.tech/` |
| Upstash Redis | `https://console.upstash.com/` |
| Render API | `https://__________.onrender.com` |
| Vercel Dashboard | `https://__________.vercel.app` |
| Google Cloud | `https://console.cloud.google.com/` |
| Anthropic | `https://console.anthropic.com/` |

---

## INSTRUCTIONS FOR CLAUDE IN CHROME

If you want Claude in Chrome to help you do each step, copy-paste the following prompt to Claude in Chrome:

---

**PROMPT TO GIVE CLAUDE IN CHROME:**

> I need you to help me deploy my SmartMail AI application. I have a project folder on my computer at [YOUR FOLDER PATH]. Here is what needs to happen, step by step. Guide me through each one, doing as much as you can for me:
>
> 1. Create a private GitHub repository called "smartmail-ai" and push my code to it
> 2. Create a free database at neon.tech (project name: smartmail) and enable the pgvector extension
> 3. Create a free Redis database at upstash.com (name: smartmail-redis)
> 4. Set up Google OAuth credentials in Google Cloud Console for a web app called SmartMail AI, and enable the Gmail API
> 5. Deploy the API to Render.com (free tier) from the GitHub repo, root directory "api", with these env vars: [paste your values]
> 6. Deploy the dashboard to Vercel.com (free tier) from the GitHub repo, root directory "dashboard"
> 7. Help me build and load the Chrome extension locally
>
> After each step, tell me what URL or credentials to save before moving to the next step.

---

That's it! Follow the phases in order and you'll have SmartMail AI live and accessible to your team.
