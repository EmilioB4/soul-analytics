# Automatic WFS inventory and product status

## One-time setup

1. Merge this PR and wait for Vercel to deploy.
2. In Supabase **SQL Editor → New query**, run `supabase/walmart_wfs_inventory.sql`. This creates separate WFS tables; it does not change or erase your CSV purchase lots, sales, fees or COGS.
3. Confirm the existing Walmart API key has WFS Inventory access. The integration reuses `WALMART_CLIENT_ID`, `WALMART_CLIENT_SECRET` and the Supabase server credentials already configured in Vercel.
4. Open **Walmart → WFS stock**. If needed, click **Check setup again**, then **Sync WFS now**. The first authenticated sync registers this owner for scheduled refresh.
5. Ensure `CRON_SECRET` is configured in Vercel for authenticated background jobs. The existing Whatnot jobs already use this variable. The added WFS job runs daily; Vercel Hobby supports this frequency. A deployed production project and a registered owner are required.

The updated setup script also creates private fee-assumption settings; see WALMART_FEE_ESTIMATES.md.

No uploaded CSV or private stock data is committed to the repository. Live account access, WFS permission and the production migration still need verification after deployment.

## What changes automatically

The tracker calls the official `GET /v3/wfs/inventory` API, downloads all pages and saves a complete per-owner snapshot. The dedicated WFS tab (in-stock products only) includes every SKU returned by this endpoint, not just products already present in the CSV or orders.

The tab enriches stock using the seller catalog /v3/items API for listing prices. Items read access is needed for prices; if it fails, stock still syncs and prices remain unavailable. Prices are snapshots with timestamps, not Buy Box guesses. Rows show only current WFS SKUs with available units.

It shows:
- Product image by LEGO set number, seller listing price/currency and available retail stock value (missing prices disclosed)
- Available units (available to sell)
- On-hand units (includes available, reserved and temporarily unavailable)
- Reserved units (orders placed but not yet fulfilled)
- Inbound units (sent to WFS, not yet received)
- Units under review or moving between fulfillment centers
- Walmart publishing status, item lifecycle, stock status and item condition
- Walmart days-of-supply/restock suggestions, aging stock and recent imported WFS order pace where available
- Estimated unit profit using saved/linked unit costs and explicitly labeled planning fees; unknown prices/costs are never guessed

The page syncs on entry, every two minutes while visible, when brought back into view, and when you click Sync WFS now. Background cron provides a daily refresh while the tab is closed. This is polling, not real-time webhooks: changes appear after Walmart reports them and the next successful sync. Faster background schedules can be configured on a plan that supports them.

WFS already deducts stock when items leave and accounts for reservations, cancellations, returns and warehouse changes. Its reported balances therefore replace the previous balances; imported orders are **not** subtracted from them again. Repeated syncs cannot repeatedly deduct the same sale. Reserved units are not added to available/on-hand totals, and inbound stock is separate.

## Purchase lots and costs

CSV purchase lots remain your purchase/cost ledger. The live WFS stock view is the authoritative view for current WFS quantities, while CSV quantities remain the imported/saved ledger snapshot. The two views are clearly labeled and are never summed together. This avoids counting the same physical units twice and avoids falsely classifying warehouse removals/losses as sold units.

For cost reference, set a purchase lot's `wm_sku` to the exact Walmart seller SKU shown in the WFS table. Linked-lot counts use exact matches. The integration does not guess lot allocations from product names or change historical order COGS.

CSV exports continue to export the purchase ledger, not a manufactured allocation of WFS stock across historical lots. WFS counts automatically update in the WFS tab, but CSV `sold`/`left` fields are not rewritten by warehouse snapshots. Per-order FIFO allocation, warehouse-loss accounting and per-movement reason tracking would require a separate movement reconciliation ledger.

## Safety and sync behavior

- A sync lease and one-minute cooldown prevent overlapping manual, browser and scheduled syncs from overwriting newer stock. Failed work releases its lease; abandoned leases expire.
- Complete snapshots are saved atomically. Incomplete pages, duplicate SKUs, missing quantity fields, malformed responses and API errors leave the last saved inventory intact.
- SKU disappearance is marked stale/not returned. It is not treated as an inventory count of zero or a sale. Stale rows remain visible but are excluded from current WFS totals.
- Stock activity shows net quantity/status changes observed between syncs, not individual shipment or loss events. The initial snapshot is explicitly labeled.
- WFS snapshots are limited to 50,000 SKUs and a request time budget; limits fail visibly rather than displaying partial totals.
- The daily route processes one registered owner per invocation, oldest attempt first. This application currently uses one Walmart account from its Vercel environment variables. Multiple independent sellers require per-owner Walmart credential connections and a worker schedule before scaling.
- A daily cron uses the existing CRON_SECRET authorization and does not accept an arbitrary owner in its request. Browser sync derives the owner from the signed-in Supabase session.

## Validation

Run `node --test tests/walmart-wfs*.test.mjs` and `npm run build`.

The WFS parser/pagination, owner authentication, cron authorization, snapshot-save flow and error preservation are tested with synthetic data. PostgreSQL-compatible PGlite validation exercises repeat migration, lease/cooldown exclusion, identical-snapshot idempotency, shipped stock decrease once, transaction rollback, stale/reappearing SKUs, owner isolation and RPC permissions. Chromium exercised the real component against synthetic API responses: first auto-sync, the two-minute polling callback, a shipped-unit decrease, repeated sync with no further deduction, cancellation releasing reserved stock, failure preserving quantities, unpublished/out-of-stock statuses and mobile layout; live Walmart quantities must be checked against Seller Center after deployment.

References:
- https://developer.walmart.com/us-marketplace/reference/getwfsinventorydetails
- https://vercel.com/docs/cron-jobs/usage-and-pricing
