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
