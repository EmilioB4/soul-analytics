# eBay financial accounting and focused dashboard

## Release setup

1. Merge/deploy to the existing main **soul-analytics** project. Preserve all current Supabase and encryption configuration.
2. Run the complete `supabase/ebay_finances.sql` in the main site's Supabase SQL Editor, after the existing `ebay_setup.sql` and `ebay_account_deletion.sql`. It adds private financial transactions, sync coverage and shipping/packaging fields; it does not move accounts or affect other marketplaces.
3. Each eBay seller reconnects once through Settings → Connections (or the collapsed connection panel) to approve `https://api.ebay.com/oauth/api_scope/sell.finances`. No new application keys are needed. Older authorizations may fail finance requests until reconnected. Finances API does not support delegated Team Access; the seller must authorize their own account.
4. Select a reporting period and click **Sync eBay**. Orders sync first, followed by financial activity. A financial failure preserves the previous financial snapshot and surfaces an error; imported orders are not rolled back or misrepresented as a successful finance refresh.
5. In **Orders & shipping**, choose **Use eBay labels**, or enter actual outside postage. Confirm packaging cost separately, including 0 only when confirmed. Enter SKU unit costs in **Product costs**. Existing manual shipping values are preserved; if an eBay label also exists, a conflict blocks profit until the seller selects eBay labels.

EU/UK finance requests can require eBay API digital signatures. This release does not implement those additional signatures. It supports USD/EBAY_US finance calls; a rejected call does not fabricate fee data. Do not promise support for every region/account or advertise 100% final profit.

## What the overview means

Four cards: matched sales before refunds, net eBay proceeds, estimated profit, and profit divided by gross sales. Connection administration is collapsed; orders/shipping, product costs and fee/activity details are separate tabs.

The main accounting view follows **financial posting dates in America/New_York**, rather than order creation dates or bank payout dates. Orders created in the selected period and older imported orders with financial activity in the period appear in the cost editor. Presets 7/30/90 end yesterday; Today and YTD include the current day up to the last sync.

The P&L starts from signed eBay transaction `amount`: credits add and debits subtract. SALE amounts already net out fees; REFUND/DISPUTE, CREDIT, NON_SALE_CHARGE and SHIPPING_LABEL movements are included once. Labels include adjustments and credits. TRANSFER is a funding movement and is excluded so a refund's financing is not charged a second time. Unknown transaction types are visible and block the profit result.

Reported fee totals and fee-type breakdowns are displayed for audit; they are **not subtracted again**. Selling fees may be billed as separate non-sale charges rather than deducted from a SALE. Account-level ad, subscription, insertion and other charges returned by Finances are included via their actual transaction amounts; no assumed percentage is used. Tax on labels is not added again to the transaction's billed amount. Taxes remitted by eBay are not treated as revenue from Fulfillment orders. A SALE must reconcile to its order's merchandise/buyer-shipping revenue and its reported fee total, or profit is withheld.

Profit = net eBay proceeds − COGS for sales posted in the period − confirmed outside postage for those sales − packaging for those sales. Imported eBay labels are already in proceeds on their posting dates; selecting them does not subtract a manual cost too. COGS uses saved current SKU unit cost across imported history, not FIFO. A cost edit can change historical estimates. Refunds reduce proceeds when posted; inventory recovery after a return is not automatically credited to COGS. The tracker does not determine whether returned inventory is resellable. This can understate profit when inventory is recovered; no final inventory accounting claim is made.

Refunds and fee credits are in net movements, and original sale units/revenue remain before refunds. The displayed profit/gross-sales percentage is not net revenue margin. Net proceeds are not a bank balance, withdrawable cash or final payout.

## Completeness and limits

- Money is parsed to integer USD cents. Invalid currencies, malformed money, unstable totals, duplicate composite IDs, out-of-window rows, provider warnings and incomplete pagination fail the entire finance import. Last good data is preserved.
- Each import is capped at 2,000 orders and 4,000 financial transactions with bounded runtime. Choose a shorter period when capped. The UI never silently takes a partial batch.
- Stable IDs are `(owner, seller, transactionType, transactionId)`, because eBay transactionId alone is not unique across types. A complete snapshot atomically replaces only its fetched posting-date interval, including transactions removed or updated by eBay.
- Profit is withheld for missing period coverage, missing original sales orders, multiple SALE rows for one order, unmatched sale/order amounts, pending finance posting for known paid orders, missing fee totals, missing COGS/postage/packaging, conflicting postage sources and unknown transaction types.
- Today data becomes stale after five minutes for the coverage check; refresh with Sync eBay. Refresh data reloads stored records and does not contact eBay. Syncs remain manual in this release.
- Source fee breakdown is not a substitute for reconciling against Seller Hub statements. eBay may post later corrections. Off-eBay fees, returns inventory adjustments, taxes on business income, independent expenses, earlier history not imported and regional API restrictions prevent a promise of 100% final accounting accuracy.

## Privacy and deletion

APIs authenticate an admitted Soul user and derive owner/seller scopes server-side. Financial tables have RLS and no browser-role grants. Provider payloads are reduced to transaction IDs/types/dates, order IDs, signed amounts and fee details: buyer identities, memos, addresses, banking data and raw financial responses are not stored. Sync uses the existing seller/owner lease and rechecks it at the atomic save. Deletion now removes the financial tables too and tombstone triggers block late writes. The earlier deletion migration is safe to rerun after finance setup without dropping the expanded cleanup behavior.

## Validation and source references

```sh
node --experimental-strip-types --test tests/*.test.mjs
node scripts/validate-ebay-finances.cjs
node scripts/validate-ebay-deletion.cjs
npm run test:isolation
npm run build
```

Browser checks use synthetic authenticated users and mocked APIs, not a real eBay account. A live seller reconnect and authenticated finance sync still need hosted validation after deployment.

Official sources: [Finances getTransactions and schemas](https://developer.ebay.com/api-docs/master/sell/finances/openapi/3/sell_finances_v1_oas3.json), [financial transaction guide](https://developer.ebay.com/api-docs/sell/static/finances/transaction-info.html), [shipping-label support](https://developer.ebay.com/api-docs/sell/finances/release-notes-archive.html), [digital signatures](https://developer.ebay.com/develop/guides/digital-signatures-for-apis).
