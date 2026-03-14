# STAGE 5: Deploy the API Server (Render)

This is the biggest stage. Take your time.

## BEFORE YOU START:

Gather all the values you saved from previous stages:
- DATABASE_URL (from Stage 2 — starts with postgresql://)
- REDIS_URL (from Stage 3 — starts with rediss://)
- GOOGLE_CLIENT_ID (from Stage 4)
- GOOGLE_CLIENT_SECRET (from Stage 4)
- Your Anthropic API key (from console.anthropic.com)
- Your SMTP2Go API key (from your SMTP2Go account)

## COPY-PASTE THIS INTO CLAUDE IN CHROME:

---

I need you to deploy my API server on Render.com. Do these steps:

1. Go to render.com
2. Sign me up or sign me in using my GitHub account (this is important — it connects Render to my GitHub repos)
3. Click "New" then "Web Service"
4. It should show my GitHub repositories. Find and select "smartmail-ai"
   - If you don't see it, click "Configure account" to give Render access to the repo
5. Set these EXACT settings:
   - Name: smartmail-api
   - Root Directory: LEAVE THIS BLANK (do not type anything)
   - Runtime: Node
   - Build Command: npm install && cd shared && npm run build && cd ../api && npx prisma generate && npm run build
   - Start Command: cd api && npx prisma migrate deploy && node dist/index.js
   - Instance Type: Free
6. Click "Advanced" to expand environment variables
7. Add EACH of these environment variables one by one (click "Add Environment Variable" for each):

   NODE_ENV = production
   API_PORT = 3001
   DATABASE_URL = (I will tell you this value)
   REDIS_URL = (I will tell you this value)
   ANTHROPIC_API_KEY = (I will tell you this value)
   GOOGLE_CLIENT_ID = (I will tell you this value)
   GOOGLE_CLIENT_SECRET = (I will tell you this value)
   GOOGLE_REDIRECT_URI = https://smartmail-api.onrender.com/api/v1/auth/google/callback
   DASHBOARD_URL = LEAVE_BLANK_FOR_NOW
   JWT_SECRET = SmartMail2024SuperSecretJWT!xyz
   JWT_REFRESH_SECRET = SmartMail2024RefreshSecret!abc
   ENCRYPTION_KEY = a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
   SMTP2GO_API_KEY = (I will tell you this value)
   SMTP2GO_SENDER_EMAIL = zzouhari@rmchomemortgage.com
   SMTP2GO_SENDER_NAME = Zak Zouhari
   ALLOWED_EMAILS = zakzouhari@gmail.com
   STRIPE_SECRET_KEY = (leave empty)
   STRIPE_WEBHOOK_SECRET = (leave empty)
   STRIPE_PRO_PRICE_ID = (leave empty)
   VOYAGE_API_KEY = (leave empty)

STOP after adding the environment variables. Ask me for the actual values for DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and SMTP2GO_API_KEY before clicking Create.

---

## WHEN CLAUDE ASKS FOR YOUR VALUES:

Give it the values you saved from previous stages. Type them in or paste them.

## AFTER CLAUDE FILLS IN ALL VALUES AND CLICKS CREATE:

Wait 3-5 minutes for Render to build and deploy. Claude should be able to see the progress.

Once it says "Live" or "Deploy succeeded", ask Claude:

---

What is the URL for my deployed service? It should be something like https://smartmail-api.onrender.com — show me the exact URL.

---

## AFTER CLAUDE IN CHROME FINISHES:

Write down your Render API URL:

RENDER_URL: ___________________________
(Example: https://smartmail-api.onrender.com)

## IMPORTANT — UPDATE GOOGLE REDIRECT URI:

Now copy-paste this into Claude in Chrome:

---

Go to console.cloud.google.com, navigate to "APIs & Services" then "Credentials", click on my "SmartMail Web" OAuth client, and update the Authorized redirect URIs. Remove the localhost one and add this exact URL instead:

https://YOUR_RENDER_URL_HERE/api/v1/auth/google/callback

(Replace YOUR_RENDER_URL_HERE with your actual Render URL)

Then click Save.

---

## YOU'RE DONE WITH STAGE 5 WHEN:

- Render shows your service as "Live"
- You've updated the Google redirect URI
- You have your Render URL saved

## SAVE THIS INFO FOR LATER:
- RENDER_URL: ___________________________
