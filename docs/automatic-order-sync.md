# Automatic recent-order imports

Run `supabase/order_auto_sync.sql` once in Supabase SQL Editor. This installs private sync preferences, a per-owner/per-platform lease, and optional Supabase Cron/pg_net/Vault scheduling. In Integrations → Automatic order sync, select connected platforms and save. The server configures one five-minute scheduler job using the existing production URL and CRON_SECRET. It continues with the browser and laptop closed, including on Vercel Hobby.

Walmart must be linked to the owner under Payout alerts or assigned through WALMART_OWNER_ID. Whatnot requires the existing WHATNOT_OWNER_ID binding. TikTok uses the owner's OAuth connection. No client-supplied owner ID can enable or run another user's jobs.

TikTok and Walmart repeatedly import a rolling 30-day creation-date window, including today. Existing IDs are upserted, so repeated checks update rather than duplicate records. Orders created more than 30 days ago still require manual historical imports, even if their status changed recently. Whatnot uses its bounded recent orders/shows importer; pagination limits or failures are reported as incomplete. This feature does not sync finance reports, final fees, refunds or WFS stock; those retain their separate sync mechanisms.

The runner handles up to three enabled jobs per invocation. It serializes each job for three minutes and enforces at least four minutes between attempts. Larger/multiple-owner workspaces can therefore have longer intervals. Last successful import updates only after a complete response. API or database failures leave an error in Integrations and retain previous records. A failed invocation can already have upserted some pages: retries safely reprocess the overlap; it is not a transactional full-history replacement.

The visible TikTok, Walmart and Whatnot dashboards refresh imported data every minute. This reads saved data; it does not make browser tabs responsible for background importing. Walmart progress and fee/refund messages appear as dismissible floating notifications, with long diagnostics expandable. Financial assumptions and unknown amounts remain represented by existing metric labels and detail sections.

Scheduler configuration does not verify network delivery. If Last successful import remains stale, inspect Integrations errors, Supabase Cron/pg_net history and Vercel deployment access. Manual Sync is still available for recovery or backfill.
