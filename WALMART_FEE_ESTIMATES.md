# Expected fees, refunds and a separate safety cushion

The previous blanket reserve model was a downside budget, not a reliable estimate of expected Walmart charges. It has been replaced. No Sellerboard totals are copied into financial data or used to force a match.

## Expected fees

1. Use a per-SKU override when explicitly configured.
2. Otherwise use the median observed matched charge for that SKU and fulfillment method. Aggregate fee components per order line; do not use the historical maximum or force learned rates up to a blanket percentage. Ambiguous bulk charges with no reported quantity are excluded from rate calibration.
3. If no history exists, label the fallback: 15% referral and $5.75 WFS fulfillment per unit. This is an uncalibrated standard-tier fallback, not a SKU quote or universal tariff. Actual discounts, category rates, shipping weight, dimensions and surcharges can differ; review SKU settings for unsupported products.
4. Prep, inbound and storage are **not** added automatically to every sale. They require matched per-unit history or an explicit SKU setting. Account-level actual charges are included when posted, not guessed as a per-sale tax.

The optional cushion is a separate planning metric. It does not reduce expected net profit, margin or ROI. A separate downside-profit figure shows its effect. The exact, unedited legacy preset is normalized to the new defaults on read; intentionally different custom overrides are preserved.

Posted actuals replace corresponding estimates and covered units. A referral fee does not complete fulfillment. Credits/taxes do not falsely complete the original base fee. Shared/ambiguous actuals offset matching expected categories dollar-for-dollar without inventing an actual per-order allocation. All estimates are computed for display and never written to the actual fee ledger.

## Dates and reporting basis

Last 30/90 days end on the last completed **America/New_York** day. Custom start/end dates and year-to-date are available. The exact bounds, imported gross units, refunded units and order count are shown. Selected dates are sent to order sync, with New York/DST-aware boundaries; date-only CSV values are preserved.

Sales use original order dates. Refunds use refund event dates; fallback dates derived from return status/creation are visibly flagged. Original-order fees retain their existing sale-date attribution, while shared account charges use posting dates. Sellerboard may have different timing options; compare equal date ranges and accounting bases.

Year-to-date and All include imported orders only. A date selector does not create missing historical records. Walmart retention, pagination, canceled-order handling, buyer shipping, original unit costs and return timing can all explain differences and should be reconciled rather than overwritten.

## Refunds before settlement

The signed-in owner reads confirmed refunded lines from Walmart's `/v3/returns` API. No payment settlement is required. Product/shipping charges are calculated separately from sales tax; pending requests and replacements are not blindly counted as refunds. Pagination must complete for refunds to be marked current. The Returns request uses documented unfiltered pagination (limit 100) and applies reporting dates locally, avoiding the failing optional modified-date filter. Returns API access is required on the existing Walmart API key.

When a matching settlement refund arrives, only the still-uncovered Returns API amount is added. Refunds are not deducted twice. Unknown/unmatched/malformed data is not treated as proof of a zero refund. If refund access fails, sales and profit after known adjustments remain visible with incomplete/before-unreported-refunds labels. The refunded-unit total is unknown, not zero. Known adjustments remain applied; a later successful retry restores the normal net-sales/profit labels.

## Returned goods and COGS

A refund does not prove that goods were returned in a recoverable condition. In the Refunds section, confirm the actual recoverable quantity and its **original sold unit cost**. The financial credit is capped at confirmed refunded units; keep-it/no-goods-expected returns cannot restore cost. Confirmations apply to the refund event period. They do not add inventory units or overwrite original sale/fee/cost records.

Run `supabase/walmart_return_recoveries.sql` once to save these confirmations. Refund lookup itself works without this new table, but no recovery is invented when it is missing. The owner can change or clear a confirmation with zero units. Access is owner-protected; writes derive owner from the authenticated session.

The P&L table separates merchandise subtotal, refunds, net GMV, shipping/WFS fulfillment, other fees, original COGS, returned-cost credits, net COGS and expected profit. Saved SKU unit costs currently apply to historical sales; if another report uses batch/FIFO or per-order costs, original COGS must be reconciled separately. Never assume identical sales subtotals imply identical COGS.

Advertising, external freight/postage, unusual charges and unrecognized settlement transactions still need their own source data. Posted refund commission credits are included when present; anticipated refund fee credits are not invented. Missing COGS, unavailable actual fee data or unknown settlement transactions still prevent a complete profit figure.

## Verification

Tests cover typical-rate calibration, legacy migration, separate cushion, partial fee coverage, refund/settlement deduplication, confirmed-cost bounds, tax exclusion, partial/pending returns, date presets/custom ranges and DST boundaries. Public tests use synthetic figures; private comparison screenshots/financial totals are not committed.

After deployment, select the exact reference dates, refresh orders/fees/refunds, inspect fee sources, and confirm recoverable returned goods. Compare the P&L lines against the reference report. Production Walmart responses, historical cost choices and return timestamps still need live verification.
