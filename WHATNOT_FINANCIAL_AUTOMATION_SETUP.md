# Whatnot Financial Automation — Phase 2

The patch changes **only** the files included in its ZIP. Existing TikTok routes, cost records, auth, and inventory remain untouched.

## Install

1. Run `supabase/whatnot_financials.sql` in your existing Supabase project's SQL Editor **before deploying**. It creates three tables: `whatnot_report_runs`, `whatnot_ledger`, and `whatnot_stream_cogs`. The tables use RLS with no direct user policies; owner-authenticated server API routes use the service role.
2. Upload the `app`, `lib`, and `vercel.json` files from the ZIP to the **root** of your GitHub repo. Don't upload an enclosing folder or the ZIP itself. Keep all other files.
3. In Vercel, ensure these existing environment variables remain set: `WHATNOT_API_TOKEN` (token with `read:orders`, `read:shows`, `read:reports`, `write:reports`), `WHATNOT_OWNER_ID` (owner's **Supabase user UUID**, not their Whatnot seller ID), `CRON_SECRET` (random private secret), `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Never share their values.
4. Wait until the Vercel deployment says Ready. Open Soul Analytics > Whatnot Overview. Click **Sync financial reports**. The first request creates up to two weekly reports. Report generation is asynchronous, so click it again after Whatnot finishes preparing them or let the daily scheduled task complete the import.
5. Once real ledger entries appear, click **Add COGS** next to the appropriate stream, enter your total product costs for that entire stream, and Save.

## Accuracy and guardrails

- Financial report rows are keyed by `ledger_transaction_id`, so overlapping weekly reports and retries don't duplicate a transaction.
- The **Net ledger earnings** figure is the sum of Whatnot's signed `transaction_amount` values. Fee, shipping, and refund columns are explanatory breakdowns **and must NOT be subtracted again**.
- Profit per show = sum of assigned ledger entries minus its manually entered stream COGS. Rows lacking a stream ID and whose order cannot be matched are shown in **Unassigned / marketplace**, not silently assigned to a show.
- Orders still awaiting completion may not appear in the financial ledger. This is settlement reporting, not a complete payout statement or real-time sales view. Refunds after a show can change earnings later.
- The sync requests current/recent weekly reports again after 24h; older weeks are generated once. Refund adjustments with a current completion date appear in current reports. The 12-week backfill needs multiple sync invocations (two new reports per invocation).
- Only USD is supported; other currency rows halt import to avoid inaccurate totals.
- The original 50/95 order discrepancy remains a separate **order pagination** verification task; ledger totals and order counts may differ because of cancellations, payment completion, and report timing.
- Report URLs are temporary; they are not stored in Supabase. The downloaded CSV is parsed server-side and never sent to the browser, and customer PII fields are not stored.

## Troubleshooting

- `Financial tables missing`: run the included SQL in Supabase.
- `Whatnot token expired or lacks ...`: confirm scope and expiration on the token used by Vercel, then redeploy; don't paste the token into chat.
- `Financial report download host not recognized`: the official report's presigned download is hosted on an unlisted domain; provide only the hostname (not the presigned URL or token) so the allowed-host policy can be updated safely.
- Report status `pending` or `in_progress`: normal; let the next scheduled sync retrieve the completed report.
- Vercel cron requires `CRON_SECRET` and a valid `WHATNOT_OWNER_ID`. The manual Sync financial reports button uses normal Soul Analytics owner authorization.

**Verification**: Static TypeScript syntax check performed. Full Next.js production build, Whatnot live report creation/response, report-host compatibility, and settlement reconciliation still need live testing. This is not a claim of verified financial accuracy.
