# STAGE 1: Push Code to GitHub

## COPY-PASTE THIS INTO CLAUDE IN CHROME:

---

I need your help creating a GitHub repository and pushing code to it. Do these steps for me:

1. Go to github.com (sign me in if needed)
2. Create a NEW PRIVATE repository called "smartmail-ai"
   - Make sure "Private" is selected, NOT Public
   - Do NOT add a README, .gitignore, or license — leave all those unchecked
   - Click "Create repository"
3. After the repo is created, I should see a page with setup instructions. Stop here and tell me the repo URL (it will look like https://github.com/MYUSERNAME/smartmail-ai.git)

DO NOT close the browser tab when done. I need the URL before continuing.

---

## AFTER CLAUDE IN CHROME FINISHES:

Write down your GitHub repo URL here: ___________________________

Example: https://github.com/zakzouhari/smartmail-ai.git

## THEN — ON YOUR COMPUTER:

You need to push the code. Open Terminal (Mac) or Command Prompt (Windows) and paste these commands ONE AT A TIME:

```
cd "PATH_TO_YOUR_ADDY_AI_FOLDER"
```
(Replace PATH_TO_YOUR_ADDY_AI_FOLDER with the actual path on your computer)

```
git init
```

```
git add .
```

```
git commit -m "Initial commit"
```

```
git branch -M main
```

```
git remote add origin YOUR_GITHUB_URL_HERE
```
(Replace YOUR_GITHUB_URL_HERE with the URL you wrote down above)

```
git push -u origin main
```

If asked for a username/password, use your GitHub username and a Personal Access Token (not your password). If you don't have a token, ask Claude in Chrome: "Help me create a GitHub Personal Access Token with repo permissions"

## YOU'RE DONE WITH STAGE 1 WHEN:

You can go to github.com, click on your smartmail-ai repository, and see all the project files listed there.

## SAVE THIS INFO FOR LATER:
- GitHub Repo URL: ___________________________
