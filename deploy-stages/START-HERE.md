# SmartMail AI — Deployment in 8 Stages

## HOW THIS WORKS

You have 8 small instruction files in this folder. Do them in order, one at a time.

Each file has a section you COPY-PASTE into Claude in Chrome. Claude will do the work for you. After each stage, you write down the important info (URLs, keys) before moving on.

DO NOT skip ahead. Each stage depends on the one before it.

## YOUR CHECKLIST

Work through these one at a time. Check off each when done:

```
[ ] STAGE 1 — GITHUB         Push your code to GitHub
[ ] STAGE 2 — DATABASE        Create the database (Neon)
[ ] STAGE 3 — REDIS           Create the cache (Upstash)
[ ] STAGE 4 — GOOGLE OAUTH    Set up Google sign-in
[ ] STAGE 5 — RENDER API      Deploy the backend (the big one)
[ ] STAGE 6 — VERCEL DASHBOARD Deploy the website
[ ] STAGE 7 — CONNECT         Wire everything together + test
[ ] STAGE 8 — EXTENSION       Install the Chrome extension (optional)
```

## YOUR SAVED VALUES

Fill these in as you complete each stage:

```
GitHub Repo URL:        ___________________________
DATABASE_URL:           ___________________________
REDIS_URL:              ___________________________
GOOGLE_CLIENT_ID:       ___________________________
GOOGLE_CLIENT_SECRET:   ___________________________
ANTHROPIC_API_KEY:      ___________________________
SMTP2GO_API_KEY:        ___________________________
RENDER_URL:             ___________________________
DASHBOARD_URL (Vercel): ___________________________
```

## ESTIMATED TIME

- Stages 1-4: About 30 minutes total
- Stage 5: About 15 minutes (the biggest stage)
- Stages 6-7: About 15 minutes total
- Stage 8: About 10 minutes (optional)

Total: About 1 hour

## TIPS

- Do ONE stage at a time — finish it completely before starting the next
- When Claude in Chrome finishes a task, WRITE DOWN the info it gives you before moving on
- If something goes wrong in a stage, tell Claude in Chrome what happened — it can usually fix it
- The API on Render's free tier "sleeps" after 15 minutes of no use. The first load after sleeping takes 30-60 seconds — that's normal
- After adding team members to ALLOWED_EMAILS in Render, they can sign in with Google OR create an email+password account

## ADDING TEAM MEMBERS LATER

To give someone access after everything is deployed:

1. Go to render.com → your smartmail-api service → Environment
2. Find ALLOWED_EMAILS
3. Add their email (any email — Gmail, Outlook, work email, anything):
   zakzouhari@gmail.com,newperson@whatever.com
4. Save. They can now sign in at your dashboard URL.
