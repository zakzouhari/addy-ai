# STAGE 3: Create Redis Cache (Upstash)

## COPY-PASTE THIS INTO CLAUDE IN CHROME:

---

I need you to set up a free Redis database on Upstash. Do these steps:

1. Go to upstash.com
2. Sign me up or sign me in (use Google sign-in if available)
3. Click "Create Database"
4. Configure it:
   - Name: smartmail-redis
   - Type: Regional
   - Region: pick US East 1 (or closest to me)
   - Leave everything else as default
5. Click Create
6. After it's created, find the REST URL or Redis URL. I need the one that starts with "rediss://" (with two s's)
7. Show me that URL

---

## AFTER CLAUDE IN CHROME FINISHES:

Write down your Redis URL here:

REDIS_URL: ___________________________

(It starts with rediss:// — that's normal)

## YOU'RE DONE WITH STAGE 3 WHEN:

- You have the Redis URL saved

## SAVE THIS INFO FOR LATER:
- REDIS_URL: ___________________________
