# Discord payout alerts

1. Run [payout_notifications.sql](../supabase/payout_notifications.sql) in the Supabase SQL Editor. The tables and claim function are server-only; no authenticated or anonymous client grants exist.
2. Set `TIKTOK_TOKEN_ENCRYPTION_KEY` to the existing 32-byte hex key used by TikTok connections. Do not replace an existing key: doing so would invalidate stored tokens and webhooks. Set `CRON_SECRET` in Vercel if it is not already set. Neither value belongs in a `NEXT_PUBLIC_` variable.
3. For Walmart, set `WALMART_OWNER_ID` to the signed-in user's UUID shown in Integrations. This binds the shared Walmart credentials to their owner. Existing Walmart client ID/secret and Reports access are required. TikTok requires the existing connection and Finance permissions.
4. Redeploy, open Integrations → Payout alerts, paste a Discord channel webhook, choose supported platforms, enable and save. Use **Send test notification**, then **Check now** to establish each platform's baseline.

The app never returns a saved webhook or puts it in browser storage. First successful provider checks silently record existing events. Later newly observed processing/paid/scheduled statuses send alerts. An existing processing payment becoming paid sends a new alert. Saving a different webhook does not replay past events. Unknown statuses and unsupported currency do not produce invented payout alerts.

## Meaning and coverage

- TikTok uses live official `/finance/202605/payments` records for the last 90 days, with complete pagination or a visible failure. PROCESSING means processing, PAID means platform-reported transferred. Neither represents funds available to withdraw or a verified bank deposit. An older payment created outside this window is not tracked.
- Walmart uses `/v3/report/payment/statement`. A positive closing balance with active payment status produces a **scheduled** alert, not an available-funds alert. Positive `paidToYou` produces **reported sent**. Cycle date and stage define the event key; balance changes in the same stage do not repeatedly notify. The API date is the scheduled cycle date, not a verified transfer timestamp. Holds/reserves can change scheduled payouts. Only the current statement is checked.
- Whatnot's documented seller API and financial CSV do not expose withdrawable balance or payout state. Whatnot alerts remain visibly unsupported; order earnings are not relabeled as available cash.
- Defaults to a daily 10:00 UTC Vercel cron for a single owner, plus manual checks. Daily checks can miss brief intermediate states; statuses may first be observed later. The cron selects one enabled owner per invocation, oldest check first. For multiple owners or higher frequency, configure an appropriate scheduler and Vercel plan. This is polling, not instant platform push notifications.

## Delivery behavior

The owner-level database lease serializes cron and manual runs. Events are keyed by owner, platform, provider ID/cycle and stage. Existing notifications are not resent. Explicit temporary HTTP errors and Discord 429 responses retry on a later check. A network timeout, invalid success response, permanent rejection, or interrupted send is marked uncertain and does not automatically resend. Discord does not provide a transactional exactly-once send with the database; check the channel and webhook when delivery is uncertain. The UI shows recent delivery states and source errors. A baseline is only committed after complete source retrieval.

Migration required for this feature only; existing sales and profit data are not changed.

References: [TikTok payments](https://partner.tiktokshop.com/docv2/page/get-payments), [Walmart statement](https://developer.walmart.com/us-marketplace/docs/payment-statement-report), [Whatnot API](https://developers.whatnot.com/api-reference), [Whatnot financial reports](https://developers.whatnot.com/reports).

## One-minute checks and branded notifications

Run [payout_notifications_fast.sql](../supabase/payout_notifications_fast.sql) once after the base migration. It installs Supabase Cron/pg_net/Vault support, private scheduler functions, and a private Walmart owner binding table. In Integrations:

1. If Walmart is not linked, click **Link my Walmart account**, then select Walmart and save. In-app linking is allowed only when there is exactly one approved profile in the workspace. Existing Vercel `WALMART_OWNER_ID` takes precedence; multiple-owner workspaces must use that explicit setting.
2. Click **Enable 1-minute checks**. The server uses the existing `CRON_SECRET` (minimum 16 characters) and Vercel's production hostname. If that automatic hostname is unavailable, set `PAYOUT_APP_URL` to the production HTTPS origin, for example `https://your-site.vercel.app`, and redeploy. No secret is entered into a browser or committed to SQL. The scheduler stores its URL and authorization token in Vault.
3. Click **Check now** once to establish the existing-payout baseline, and **Send test notification** to see the teal/lavender Soul embed in Discord.

The scheduler runs through Supabase even when the site is closed and supports Vercel Hobby's restriction on native cron frequency. The existing daily Vercel cron remains a fallback. A single named Supabase job is updated on reconfiguration, not duplicated. Disable it in Supabase Cron if no longer needed; disabling notifications in the site immediately prevents subsequent checks from sending.

The alert amount, platform, status and date use a compact branded embed; test messages use the same styling with an explicit test label. Notification history refreshes every 15 seconds while Integrations is visible. Near-real-time means one-minute polling after the platform exposes a status, plus API and delivery latency—not immediate notification when Seller Center first shows a withdrawable balance. TikTok processing/paid and Walmart scheduled/reported-sent statuses retain their original meanings. No unsupported “funds available” event is invented.

Scheduler setup is not proof that HTTP calls are succeeding. Check Last check and errors in Integrations, and job/request history in Supabase Cron/pg_net, especially if deployment protection blocks background requests. For multiple enabled owners the existing scheduler processes one owner per run; each owner's interval increases accordingly.

References: [Supabase scheduled HTTP calls and Vault](https://supabase.com/docs/guides/functions/schedule-functions), [Vercel cron frequency limits](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing).


TikTok's PROCESSING event is presented as **Payout initiated**, followed by a separate **Sent** alert if the payment becomes PAID. Internal status keys stay unchanged, so updating the message label does not replay already recorded events. A payment already PAID when first observed does not fabricate an earlier initiation event. Walmart's statement exposes scheduled and reported-sent values, not a separate reliable initiation signal.
