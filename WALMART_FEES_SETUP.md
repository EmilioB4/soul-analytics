# Walmart actual settlement charges

## One-time setup

1. In your Supabase project, open **SQL Editor → New query**.
2. Copy and run the full contents of `supabase/walmart_settlements.sql`.
3. Merge this pull request and wait for the Vercel production deployment to finish.
4. Open **Walmart Overview → Sync actual fees**, or **Sync Walmart orders** (which also refreshes fees).
5. If Walmart returns HTTP 403, enable Reports access for the Marketplace API key in Walmart's developer settings. Keep credentials in Vercel environment variables.

The existing `WALMART_CLIENT_ID`, `WALMART_CLIENT_SECRET` and Supabase server credentials are reused. No new credential is needed. This change adds tables and a service-role-only report replacement function; it preserves the existing sales, CSV fee and COGS tables.

## What is included

The API lists available v1 reconciliation reports from the last 120 days, then fetches every page of each report using Walmart's byte offsets. Each complete report replaces its previous snapshot in one database transaction. Retry imports do not append duplicate fees, corrected reports replace old amounts, and failed/partial downloads leave the previously imported report untouched.

Original signed amounts and source rows are retained. Fee debits increase costs; fee credits/reimbursements reduce costs. Referral/commission, WFS fulfillment, prep, storage, inbound, removal and other recognized charge types are included **when Walmart posts them in these reports**. Sales tax and payout/reserve transfers are kept out of operating fee totals. Original sales amounts are not counted a second time. Reported product refunds and shipping transactions adjust revenue. Unrecognized transaction types remain visible for review and suppress profit until their accounting is implemented.

Charges match purchase order, line and SKU where supplied. Matched costs follow order date filters even when posted later. Account-level charges, missing identifiers and ambiguous product allocations are shown as unallocated; they are included in the All fulfillment view, and excluded with an explicit disclosure from WFS/SF views. A fee is never duplicated across product rows solely because the same SKU sells through two fulfillment channels.

## Limits and verification

- Walmart may not post fees until settlement. A reported fee is not proof that every fee for that order is final. Orders with no linked fees display Pending, and profit is always labeled provisional.
- Third-party prep, external freight, advertising and charges absent from reconciliation reports require normalized CSV import. Never manually import the same charge already included in an automatic report. Existing manual fees remain included and the dashboard warns about overlap.
- COGS still comes from your saved unit costs; returned inventory does not automatically reverse COGS. Product contribution excludes shared or ambiguous charges.
- Sync runs when you click a sync button; it is not a background scheduler. Keep the page open until completion. API permission errors, unknown schemas, time budgets, oversized reports and incomplete syncs are reported explicitly.
- Each report has a 50,000-row import cap and a request time budget; oversized/slow reports fail without replacing the saved snapshot. The dashboard fetches data in 1,000-row pages and fails visibly above 100,000 rows rather than silently truncating.
- After the first live sync, compare the fee-type totals and a few order lines against the corresponding Walmart settlement report, especially prep/storage and credits. Live account charges cannot be verified from repository source alone.

## Validation

Run `node --test tests/walmart*.test.mjs` on Node 24 with project dependencies installed, then `npm run build`.

A Chromium test of the actual dashboard with synthetic data verified combined profit and fees, WFS filtering with shared-charge disclosure, and the fee-sync button.

The migration was also exercised in a local PostgreSQL-compatible PGlite instance: repeat application, retry idempotency, corrected-report replacement, transaction rollback, and authenticated-user RPC denial.

API references:
- https://developer.walmart.com/us-marketplace/reference/getavailablev1reconreportdates-1
- https://developer.walmart.com/us-marketplace/reference/getavailablev1reconreportasjson-1
