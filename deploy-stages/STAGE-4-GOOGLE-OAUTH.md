# STAGE 4: Set Up Google Sign-In (Google Cloud)

## COPY-PASTE THIS INTO CLAUDE IN CHROME:

---

I need you to set up Google OAuth so people can sign in to my app with their Google account. Do these steps in Google Cloud Console:

1. Go to console.cloud.google.com
2. Sign me in if needed
3. At the top of the page, click the project dropdown and create a NEW PROJECT:
   - Name: SmartMail AI
   - Click Create
   - Wait for it to be created, then SELECT that project
4. In the left menu, go to "APIs & Services" then "OAuth consent screen"
   - Choose "External" for user type
   - Click Create
   - App name: SmartMail AI
   - User support email: zakzouhari@gmail.com
   - Developer contact email: zakzouhari@gmail.com
   - Click Save and Continue through the remaining screens (leave scopes and test users as default for now)
5. Now go to "APIs & Services" then "Credentials"
   - Click "Create Credentials" at the top
   - Choose "OAuth 2.0 Client IDs"
   - Application type: Web application
   - Name: SmartMail Web
   - Under "Authorized redirect URIs", add this EXACT URL:
     http://localhost:3001/api/v1/auth/google/callback
   - Click Create
6. A popup will show the Client ID and Client Secret. Show me BOTH of these values.
7. Then go to "APIs & Services" then "Library"
   - Search for "Gmail API"
   - Click on Gmail API
   - Click "Enable"

Show me the Client ID and Client Secret when done.

---

## AFTER CLAUDE IN CHROME FINISHES:

Write down these two values:

GOOGLE_CLIENT_ID: ___________________________
(Looks like: 123456789-abcdefg.apps.googleusercontent.com)

GOOGLE_CLIENT_SECRET: ___________________________
(Looks like: GOCSPX-abcdefghijk)

## YOU'RE DONE WITH STAGE 4 WHEN:

- You have both the Client ID and Client Secret saved
- Gmail API is enabled

## SAVE THIS INFO FOR LATER:
- GOOGLE_CLIENT_ID: ___________________________
- GOOGLE_CLIENT_SECRET: ___________________________
