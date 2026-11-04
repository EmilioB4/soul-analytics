SOUL ANALYTICS — PAYOUTS TAB

Adds a Payouts tab in the sidebar with existing daily, weekly, monthly, YTD, and custom date-range filters.
Uses the finance data already supported by the latest FIFO + Payout update.

Payouts shows:
- Gross product sales for counted orders in the selected date range.
- MODELED expected payout = product sales less ASSUMED 6% TikTok fees and available seller net shipping charges.
- Imported final settlement sums matched to order ID, attributed to order date (NOT bank payout date).
- Counts of settled orders, orders missing settlement records, and orders missing shipping details.
- Confirmed bank payouts are clearly labeled 'Not connected'.

IMPORTANT: This is not yet TikTok's own estimated payout API. An unsettled transaction estimate importer and actual payout records would be separate backend work. Do not interpret the modeled number as official TikTok payout, or the settlement sum as bank money received. These amounts could differ due to refunds, affiliates, reserves, adjustments and missing shipping.

PREREQUISITE: Deploy the preceding Soul-Analytics-FIFO-Payout-Update first and run its supabase/fifo_batches.sql migration. This tab relies on payoutEstimate fields returned by that update's analytics endpoint. For safety, the ZIP contains the matching analytics route alongside page.tsx; don't install alongside an older inventory migration.

INSTALL:
1. Back up your currently working GitHub main branch via Code > Download ZIP.
2. At GitHub repo ROOT, upload the app folder from this extracted ZIP (do not upload an extra parent directory).
3. Check file paths app/page.tsx and app/api/analytics/route.ts. Commit.
4. Verify Vercel production build status Ready; test Payouts tab with one-day and custom ranges.

NO NEW ENVIRONMENT VARIABLES OR TABLES beyond the prior FIFO patch.
Only app/page.tsx changes UI; analytics/route.ts is included to keep payout shape consistent with latest FIFO patch.
The source was checked with TypeScript transpile syntax but full production build/live API not verified.
