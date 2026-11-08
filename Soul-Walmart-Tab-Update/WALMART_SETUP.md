# Soul Analytics — Walmart setup (Phase 1)

## 1. Create the tables
Open Supabase > SQL Editor and run `supabase/walmart.sql` once. Existing TikTok/Whatnot data is unchanged. Owner-only RLS policies protect Walmart records.

## 2. Open the Walmart Overview tab
The Walmart tab provides fulfillment filters (All/WFS/SF), date windows, a SKU-level table with inline editable unit COGS, fee breakdown, revenue, and conditional profit/margin/ROI.

## 3. Import CSVs
Use the built-in **Download sales template** and **Download fees template** buttons. These are *normalized templates*, NOT the native Walmart report format. Transform native Walmart order/reconciliation/WFS reports to the template headers before importing.

Sales template columns:
`order_id,line_id,order_date,sku,product_name,fulfillment,quantity,revenue`
- Use one unique `line_id` per order line, `YYYY-MM-DD` order date, WFS / SF / Unknown.
- Revenue is merchandise sales for that line; avoid including a payout or deposit as revenue.

Fees template columns:
`transaction_id,fee_date,sku,order_id,fee_type,amount`
- Use a unique ID per *fee transaction*. Positive amount = expense; negative = credit or reversal.
- Preserve Walmart's original fee type. Leave SKU/order blank for shared charges; those affect dashboard totals but are not assigned to individual products.
- Import all available referral, WFS fulfillment, prep, storage, inbound, return, adjustments and any other fees. Avoid importing the same charge twice from overlapping reports.
- Outside-provider prep, seller-paid freight and Walmart Connect ads must be recorded separately if absent from settlement reports.

Reimporting identical IDs updates rather than duplicates records. This phase does NOT parse native Walmart reports, perform automated API sync, implement FIFO, or reconcile settlements; profit is provisional until complete charges are imported.

## 4. Walmart APIs for Phase 2 (automatic sync)
In Walmart Seller Center / Walmart Developer Portal, obtain Walmart Marketplace API credentials for your own seller account. Ask for access to the relevant **Orders**, **Reports**, **Payments / reconciliation**, **Items**, and **WFS** reporting endpoints as available for your account. Keep Client ID and Client Secret server-side in Vercel environment variables (never `NEXT_PUBLIC_*`, GitHub, or chat). Exact report availability and authorization depend on account permissions.

If you use Walmart Connect advertising, that is a **separate advertising integration** with its own access/authorization and reporting. External prep providers and inbound carriers do not automatically appear in Walmart's API and may need invoices or manual imports.

Next development phase: secure token exchange, scheduled sync, original transaction IDs, deduplication across settlement reports, WFS/SF fulfillment mapping, and reconciling actual charges to SKU, order, and settlement period. Do not treat estimated fee schedules as actual charges.
