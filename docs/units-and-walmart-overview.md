# Unit counts and Walmart overview

Walmart now has reporting-period buttons, summary cards for revenue/units/orders/estimated profit, a sales chart, top products ranked by imported sale quantities, and WFS/seller-fulfilled product performance. No livestream metrics are used. The header displays Walmart data and its refresh button refreshes Walmart. All previously available fee, cost, ROI and reconciliation detail remains below the overview.

Walmart Units sold sums the original quantities in imported order lines for the selected date/fulfillment filter. Confirmed refunded units are shown separately. This is a gross sale-quantity count, not a claim of final net quantities after every refund.

Whatnot stores `quantity_sold` from ORDER_EARNINGS rows in the official financial CSV. Run `supabase/whatnot_units_sold.sql` once and use Sync financials. Legacy report windows with missing quantities are queued for replacement reports, at most two windows per sync; reports are asynchronous, so later syncs complete the imports. Existing ledger amounts and stream COGS remain available while reports regenerate. If provider history cannot be retrieved, missing quantities remain pending.

Whatnot units appear in the overview, show library and selected-show summary. Counts use original settled sale quantities. Monetary refund/fee rows do not add or subtract units. A partial known quantity displays a `+`, and missing quantities are never inferred from the number of orders. Period grouping remains the existing first-recorded-sale date per stream.

Deploying before the migration does not break financial summaries: the API falls back to existing fields and reports that unit setup is required. TikTok stream metrics are unchanged.

Source: [Whatnot financial CSV columns](https://developers.whatnot.com/reports).
