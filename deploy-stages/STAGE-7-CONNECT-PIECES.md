# STAGE 7: Connect Everything Together

Now we need to tell the API server where the dashboard lives, and update a couple of settings.

## BEFORE YOU START:

You need:
- Your Render URL (from Stage 5)
- Your Vercel dashboard URL (from Stage 6)

## COPY-PASTE THIS INTO CLAUDE IN CHROME:

---

I need you to update an environment variable on my Render deployment. Do these steps:

1. Go to render.com
2. Click on my "smartmail-api" service
3. Go to the "Environment" tab on the left
4. Find the variable called DASHBOARD_URL
5. Change its value from blank to my Vercel URL:
   https://YOUR_VERCEL_URL_HERE
   (Replace with your actual Vercel URL, like https://smartmail-ai.vercel.app)
6. Also find GOOGLE_REDIRECT_URI and make sure it says:
   https://YOUR_RENDER_URL/api/v1/auth/google/callback
   (with your actual Render URL)
7. Click "Save Changes" at the bottom
8. The service will restart automatically — wait for it to say "Live" again

---

## THEN UPDATE GOOGLE CLOUD (if not done in Stage 5):

---

Go to console.cloud.google.com and navigate to APIs & Services then Credentials. Click on my SmartMail Web OAuth client. Make sure the Authorized redirect URIs contains:

https://YOUR_RENDER_URL/api/v1/auth/google/callback

Also add my Vercel URL to the "Authorized JavaScript origins" list:

https://YOUR_VERCEL_URL_HERE

Click Save.

---

## TEST IT:

Open a new browser tab and go to your Vercel dashboard URL. You should see the SmartMail AI login page. Try these:

1. Click "Sign in with Google" — you should be redirected to Google and then back to the dashboard
2. If Google sign-in works, you're connected!

## COMMON ISSUES:

If Google sign-in gives an error:
- "redirect_uri_mismatch" → The redirect URI in Google Cloud doesn't match exactly. Check for typos, missing https://, or extra slashes
- "access_denied" → Your email isn't in the ALLOWED_EMAILS list in Render
- Page just spins → The API might be sleeping (free tier). Wait 30 seconds and try again

## YOU'RE DONE WITH STAGE 7 WHEN:

- You can sign in to the dashboard with your Google account
- You see the SmartMail AI dashboard after logging in
