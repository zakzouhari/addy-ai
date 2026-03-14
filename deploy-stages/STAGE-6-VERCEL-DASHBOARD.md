# STAGE 6: Deploy the Dashboard Website (Vercel)

## BEFORE YOU START:

You need your Render URL from Stage 5 (example: https://smartmail-api.onrender.com)

## COPY-PASTE THIS INTO CLAUDE IN CHROME:

---

I need you to deploy my Next.js dashboard website on Vercel. Do these steps:

1. Go to vercel.com
2. Sign me up or sign me in using my GitHub account
3. Click "Add New" then "Project"
4. Find and import my "smartmail-ai" repository from GitHub
5. Before deploying, configure these settings:
   - Click "Edit" next to Root Directory and type: dashboard
   - Framework Preset should auto-detect as "Next.js" — make sure it says Next.js
6. Open the "Environment Variables" section
7. Add ONE environment variable:
   - Name: NEXT_PUBLIC_API_URL
   - Value: https://smartmail-api.onrender.com/api/v1
   (NOTE: Replace "smartmail-api.onrender.com" with my actual Render URL if different)
8. Click "Deploy"
9. Wait for the build to finish (2-3 minutes)
10. When done, show me the URL that Vercel gives me (looks like: https://something.vercel.app)

---

## AFTER CLAUDE IN CHROME FINISHES:

Write down your Vercel dashboard URL:

DASHBOARD_URL: ___________________________
(Example: https://smartmail-ai.vercel.app)

## YOU'RE DONE WITH STAGE 6 WHEN:

- Vercel shows "Ready" or deployment succeeded
- You have your dashboard URL saved
- You can actually visit the URL in your browser and see a login page
