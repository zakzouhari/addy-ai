# STAGE 2: Create the Database (Neon)

## COPY-PASTE THIS INTO CLAUDE IN CHROME:

---

I need you to set up a free PostgreSQL database on Neon for my app. Do these steps:

1. Go to neon.tech
2. Sign me up or sign me in (use Google sign-in if available)
3. Create a new project:
   - Project name: smartmail
   - Pick the region closest to me
   - Click Create
4. After the project is created, find the CONNECTION STRING. It looks like this:
   postgresql://neondb_owner:something@ep-something.region.aws.neon.tech/neondb?sslmode=require
5. Copy that full connection string and show it to me
6. Then go to the SQL Editor in the Neon dashboard
7. Run this command in the SQL Editor:
   CREATE EXTENSION IF NOT EXISTS vector;
8. Tell me when both steps are done

---

## AFTER CLAUDE IN CHROME FINISHES:

Write down your database connection string here:

DATABASE_URL: ___________________________

(It starts with postgresql:// and is very long — that's normal)

## YOU'RE DONE WITH STAGE 2 WHEN:

- You have the connection string saved
- The vector extension was enabled (Claude should confirm this)

## SAVE THIS INFO FOR LATER:
- DATABASE_URL: ___________________________
