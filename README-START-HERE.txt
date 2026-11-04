SOUL ANALYTICS — FIFO PURCHASE BATCHES + PAYOUT ESTIMATES

WHAT THIS PATCH ADDS
- Products & COGS: Manage purchase batches with acquisition date, unit cost and quantity; edit/delete. FIFO applies oldest eligible inventory first across imported order dates. SKU without purchase batches continues using its saved fixed unit cost. If units are missing or dated after a sale, those units have unknown COGS; affected profit is partial.
- Stream Summary section: expected payout and summed imported order settlements for selected dates. Not part of PNG image; existing card design remains unchanged.
- Expected payout = counted product sales subtotal - 6% assumed TikTok fee - any imported net seller shipping charges for covered orders. Does not subtract COGS, because purchase costs aren't deducted from TikTok's payout. Excludes refunds, affiliate commissions, reserves, subsidies, separately billed charges. Missing shipping is flagged.
- Imported order settlements = sum of settlement_amount values for selected creation-date orders that have finance records; NOT confirmed bank transfers.
- Actual deposited payout requires TikTok payment/payout records. It is shown as 'Not connected' rather than inventing a number. One selected date range can include several livestreams.

INSTALL IN ORDER
1. BACK UP your current GitHub main branch (Code > Download ZIP).
2. Supabase SQL Editor > New snippet. Open supabase/fifo_batches.sql and run CREATE TABLE, CREATE INDEX, ALTER TABLE individually. Do NOT run as a Logs query. All queries are additive: no existing tables overwritten.
3. At GitHub repo root, upload the CONTENTS of this ZIP (app, lib), not a parent folder and not the ZIP. Verify paths such as app/StreamSummaryCard.tsx, app/InventoryBatches.tsx, app/ProductFinance.tsx, app/api/analytics/route.ts, app/api/tiktok/products/route.ts, app/api/inventory/batches/route.ts, lib/fifo.ts.
4. Commit, check Vercel's Production deployment says Ready. Test the new Inventory Batches panel and date-range payout panel before relying on figures.
5. Enter historical purchase batches from before the first imported sale; otherwise pre-batch historical inventory won't be costed.

LIMITATIONS / TESTING
- This is a patch against the repository ZIP supplied earlier, plus latest Stream Summary styling patch. Deploy and verify before relying on numbers.
- ZIP integrity, TypeScript/TSX transpile syntax, and a simple two-batch FIFO test passed. A full Next.js build could not be completed because npm dependency installation timed out in this environment.
- Current importer and reporting have 5k–20k row caps; if those are reached, some costs and profits are incomplete.
- Do not interpret order settlement sums as bank payout. TikTok can pay out later and withhold/release reserves; Seller Center Payout/Payment records are needed to track what reached your bank.
- Existing 6% referral fee is just an estimate, not an exact TikTok fee report.
