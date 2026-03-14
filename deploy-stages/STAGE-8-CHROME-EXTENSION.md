# STAGE 8: Install the Chrome Extension (Optional)

This stage installs the SmartMail AI toolbar into Gmail. It's optional — the dashboard works without it.

## BEFORE YOU START:

You need:
- Your Render URL (from Stage 5)
- Node.js installed on your computer (download from nodejs.org if you don't have it)

## STEP 1: Update the API URL

On your computer, find this file in your Addy AI folder:
extension/src/utils/api.ts

Open it in any text editor (even Notepad). Near the top, find this line:
const API_BASE = 'http://localhost:3001/api/v1';

Change it to:
const API_BASE = 'https://YOUR_RENDER_URL/api/v1';

(Replace YOUR_RENDER_URL with your actual Render URL)

Save the file.

## STEP 2: Build the Extension

Open Terminal (Mac) or Command Prompt (Windows) and run:

```
cd "PATH_TO_YOUR_ADDY_AI_FOLDER/extension"
npm install
npm run build
```

This creates a "build" or "dist" folder inside the extension directory.

## STEP 3: Load It in Chrome

1. Open Chrome
2. Type chrome://extensions/ in the address bar and hit Enter
3. Turn on "Developer mode" (toggle in the top right corner)
4. Click "Load unpacked"
5. Navigate to your Addy AI folder → extension → build (or dist)
6. Select that folder and click Open
7. The SmartMail AI icon should appear in your Chrome toolbar

## STEP 4: Test It

1. Go to Gmail
2. Click Compose to start a new email
3. You should see SmartMail AI tools in the compose window

## YOU'RE DONE WITH STAGE 8 WHEN:

- The SmartMail AI icon appears in your Chrome toolbar
- You can see SmartMail buttons when composing an email in Gmail

## IF YOU SKIP THIS STAGE:

That's totally fine! The web dashboard (from Stage 6) works independently. The Chrome extension is just extra convenience for using SmartMail directly inside Gmail.
