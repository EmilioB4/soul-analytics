SOUL ANALYTICS — WHATNOT API PHASE 1

1) Supabase SQL Editor: run supabase/whatnot.sql (creates private, server-only tables).
2) Whatnot Seller Hub > Seller API > Personal access tokens: create a token scoped ONLY to read:orders and read:shows. Only the Whatnot account owner can generate tokens. Save it securely when it is shown once.
3) In Vercel > Project > Settings > Environment Variables add:
   WHATNOT_API_TOKEN = your secret Whatnot personal access token
   WHATNOT_OWNER_ID = the existing Supabase auth.users UUID for the Soul owner/account that should own imported records
   CRON_SECRET = a strong random value (Vercel cron uses it as Bearer auth)
   Never add the token to NEXT_PUBLIC_ variables, GitHub, chat or screenshots.
4) Deploy and open Whatnot. Click Sync Whatnot after tables and environment variables are configured.
5) The included vercel.json schedules one import per day at 09:00 UTC. If Vercel rejects this schedule on your plan, adjust it according to Vercel's current Cron limits.
6) The importer fetches up to 5 pages each for orders and shows per execution. Existing records are upserted by Whatnot ID, not duplicated. Check for pagination differences in your live account's API response before relying on complete historical backfills.
7) The app shows real imported counts and statuses, but not yet dollars or profit. The API payload is retained server-side so we can map revenue, fee, payout and auction bundle fields precisely in Phase 2. Never treat generic listing names as actual products.
8) The scheduled job's authorization requires CRON_SECRET and binds records to WHATNOT_OWNER_ID; confirm that UUID is correct before enabling cron.

ROLLBACK: Revert this commit in GitHub. Supabase tables can remain in place; reverting does not delete your TikTok, Chase or other data.
