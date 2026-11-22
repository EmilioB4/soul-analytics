# Walmart daily orders and funded incentives

## Deployment

1. Merge/deploy this update to the existing main Soul Analytics project.
2. In that site's Supabase SQL Editor run the whole `supabase/walmart_order_pricing.sql`. This only adds nullable JSON order-pricing evidence to `walmart_sales`; it does not rewrite historical amounts, remove records or change permissions. The migration can be rerun.
3. Open Walmart Overview, choose the period containing the affected orders and select Sync Walmart. For a single day, use **Orders of the day → Sync this day**. Existing rows update by owner + purchase order + line ID. No account reconnection or new credentials are required.
4. Re-sync older affected dates too. Adding a column cannot recover funding details that were never requested. CSV/older rows with no pricing metadata show buyer total as Re-sync to load. Automatic syncs will also use the new source fields going forward, once the migration is installed.

## Overview cleanup

Removed the fulfillment performance table/extra metrics, reconciliation export panel, Revenue/refunds/costs disclosure, redundant refund shortcut and Expected fee sources by SKU disclosure from Overview. Refunds remain in their existing sidebar tab. Product costs, order-charge reconciliation and fee/import tools remain available below; no financial records are deleted.

The new daily list defaults to today and has an independent day picker, fulfillment filter and 25-order pagination. It groups multiple item lines under each purchase-order ID, shows Walmart's customer order ID when available, item names/SKUs/quantities, seller item total, buyer total including reported shipping/tax and an incentive badge. It does not display buyer names, addresses or contact details. Its selected day is independent of the summary/chart reporting period. The seller item total is not a bank payout or amount after fees/refunds. Buyer totals cover the non-cancelled lines imported by the existing sync, not an independently reconciled customer-wide checkout across other purchase orders.

## Why $159.99 can represent $169.99 seller item revenue

Walmart's Orders API supports **incentiveInfo=true**. The documented `orderLine.incentive` object contains `type`, `originalPrice`, `walmartFundedIncentive`, `originalReferralFee` and `reducedReferralFeeDiscount`. This update requests the option on first and cursor pages for both seller-fulfilled and WFS orders.

For an explicit **Walmart funded** incentive, the parser uses order-time original-price and funding amounts only when the amounts reconcile to the PRODUCT charge. It does not read today's catalog price or assume every discount is funded by Walmart. Seller discounts and reduced-referral incentives retain the source product charge.

Example (quantity 1): buyer PRODUCT charge $159.99 + Walmart funding $10 = seller item revenue $169.99. With $11.60 reported tax and $0 shipping, buyer order total is $171.59. Tax is not added to seller item revenue. If the PRODUCT charge already reports $169.99, it is not increased by another $10; the buyer amount is shown separately.

For multiple units, the parser accepts whole-line or per-unit amount interpretations only when there is one unique arithmetic-consistent answer. Missing, inconsistent or ambiguous incentive data keeps the source charge and marks Funding needs review instead of guessing. Raw source API amount descriptions do not establish every quantity edge case, so a real multi-unit payload may require further validation.

## Profit and settlement safeguards

Corrected seller revenue flows into existing charts, COGS/fee calculations, daily Discord summaries and new sale candidates. It is not an extra synthetic fee credit. Unclassified settlement rows already withhold profit. If a classified fee's source amount-type/description identifies Walmart-funded credits, the update also withholds profit for review rather than assuming the credit can be added on top of restored revenue. Ambiguous order incentives withhold dashboard/product contribution and daily-summary profit. This release does not claim every funded-incentive settlement format is reconciled.

The old imports remain unchanged until re-sync. Actual settlement fees, refunds, adjustments and later corrections still matter; the original listed price is not the same as final net proceeds. Provider-reported order-time evidence still needs to be checked against real seller records after deployment.

## Validation

- Parser tests cover the $169.99 / $159.99 / $10 example, reported tax, already-inclusive PRODUCT amounts, per-unit/whole-line quantities, ambiguity, reduced-referral/seller discounts and invalid currency.
- Route tests prove incentiveInfo requests, owner-derived writes and no saved buyer personal data.
- Daily grouping tests cover multiple item lines, both IDs, fulfillment/date filters and missing legacy totals.
- PostgreSQL/PGlite migration tests prove rerun safety, unchanged historical amounts and retained cross-user isolation.
- Daily-summary checks retain existing accounting behavior and withhold profit for incentive review.

Official sources: [Orders API incentiveInfo parameter and response schema](https://developer.walmart.com/us-marketplace/reference/getallorders), [Walmart-funded incentives and seller payment explanation](https://developer.walmart.com/us-marketplace/docs/price-incentives-overview).

## Signed incentive amounts

Walmart-funded incentive amounts may be represented as a signed discount. For explicit Walmart-funded orders only, both +10 and -10 are normalized to a $10 funded amount and must still reconcile to the order-time original price. Negative merchandise, shipping, tax or original-price values remain invalid. No settlement posting delay is required for this order-time calculation.

New syncs save only the original-price/incentive amount and currency as pricing evidence, including the original sign, plus a structured mismatch reason. Buyer names, addresses and other raw payload fields are not retained. Unresolved rows show Incentive data mismatch and an expandable View incentive data section; this is an importer/source-data diagnostic, not a Walmart funding approval status. Older rows need re-sync. No new SQL is needed once walmart_order_pricing.sql has been installed.
