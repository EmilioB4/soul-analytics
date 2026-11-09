# Walmart inventory tracker

## Enable and import

1. Merge this pull request and wait for Vercel to finish deploying.
2. In Supabase **SQL Editor → New query**, run the contents of `supabase/walmart_inventory.sql` once.
3. Open **Walmart → Inventory**, click **Refresh**, then **Import inventory**.
4. Choose your LEGO inventory CSV, review the preview and matching lot IDs, then click **Confirm import**.

You can preview a CSV even before database setup. Saving and exporting saved stock require setup and a signed-in account. The empty state links to the setup SQL.

## Compatible CSV

The tracker accepts the provided 36-column format:

```csv
id,sku,name,status,stage,buy_date,store,qty,unit_price,discount_pct,cashback_pct,shipping,unit_cost,order_no,payment,event,condition,location,wfs_shipment,wm_sku,plan,target_price,target_date,tags,sold,left,realized,days_to_sell,value_now,wfs_price,wfs_src,wfs_net,profit_unit,unrealized,total_profit,notes
```

Required columns/values are `id,sku,name,stage,qty,sold,left`. Other original columns can be blank and are retained for editing/export. Unknown columns, duplicate IDs, invalid dates, fractional quantities and inconsistent stock balances are rejected before saving. Dates use YYYY-MM-DD, percentages use 0–100, and monetary values accept currency symbols and thousands separators when CSV-quoted appropriately. UTF-8 BOM, quoted commas, escaped quotes and multiline notes are supported. Limit: 5,000 lots / 8 MB per import.

## Stock and cost rules

- Each `id` is a stable purchase-lot identifier. `sku` groups lots by LEGO set; it is kept separate from `wm_sku`, the Walmart seller SKU.
- A re-import updates matching IDs. Lots not in the file are kept. The preview explains replacements; do not reuse an existing ID for an unrelated purchase. Imports are atomic and repeated identical imports do not create duplicate lots or activity entries.
- Remaining units must equal `qty - sold`. Edit a lot to record sold units, receive stock, update locations, or track a shipment. Reducing sold records a return. Quantity changes should reflect a stock correction or added units in the same lot.
- Remaining cost value is `left × unit_cost` for each lot, summed across lots. The landed `unit_cost` supplied by the file is authoritative; the tracker does not guess taxes/discounts from `unit_price`. Missing costs are disclosed as partial values. Average remaining cost is weighted by remaining units.
- Ordered units remain distinct from received stock. Received stock includes stages `received`, `at_wfs` and `listed`. `ordered` is on-order stock; other stages are reported separately. Low stock means 1–5 received units per set; these are tracked stock balances, not Walmart live available-to-sell quantities.
- Imported `value_now`, `wfs_price`, `wfs_net`, realized/unrealized/total profit fields are retained snapshots. They are not refreshed from the Buy Box or used as actual settlement profit. Editing stock/cost does not silently recompute these original snapshots.
- Order sync does not automatically decrement inventory: the CSV already contains sold quantities, so deducting historical imported orders again would double-count sales. Walmart stock sync and automatic sale-to-lot allocation are not enabled in this version.
- Inventory costs do not overwrite Walmart historical order COGS or settlement fees.

## Editing, exporting and history

Search sets, SKUs, invoices, locations and tags. Filter by stage, low stock, on-order stock or sold-out sets. Expand a set to see its purchase lots, edit a lot and enter a reason for the change. All 36 source fields are available in the editor, with pricing snapshots under a separate disclosure. A stale edit is rejected if another session changed the lot. Re-importing an older CSV replaces matching manually edited lots, so export your latest saved snapshot before doing further external edits.

CSV export includes all saved lots in the original column order, regardless of current search/filter. Recent activity records before/after lot snapshots. Each owner can read only their own inventory and history; writes use authenticated owner API routes and a service-role-only database function.

The migration creates separate inventory tables and a history trigger, preserving existing sales, fee, COGS and settlement tables. No uploaded inventory CSV, invoices or payment details are committed to the public repository.

## Validation

Run `node --test tests/walmart-inventory*.test.mjs` and `npm run build`. The import parser was also exercised locally against the user's uploaded CSV. Database validation checked repeat migration application, idempotent imports/history, stock edits, optimistic concurrency, transaction rollback, owner isolation and RPC permissions in PostgreSQL-compatible PGlite. A Chromium check exercised the real component with the uploaded CSV against a local test API: preview before setup, initial import, repeat import, purchase-lot sale edits, all-column export and mobile panel layout. Production Supabase persistence still needs the one-time migration and live verification.
