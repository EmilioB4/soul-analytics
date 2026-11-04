SOUL ANALYTICS - CLEANER OVERVIEW + ORDERS INSIGHTS

This is a small patch, not the whole project. Upload only the app/ folder contents to GitHub repository root.
Files: app/page.tsx and app/api/analytics/route.ts.

Overview: Exactly four metrics - product sales, counted orders, average product subtotal, estimated profit. Detailed 6% fees and COGS remain in Products & COGS.
Orders: Imported order count, canceled order count and subtotal, status-based refund count, recorded settled shipping total, average shipping per covered order, per-order shipping where available. Refund dollar amount is not available from current imports; not represented as zero.

Shipping values are pulled from existing tiktok_order_finance.shipping_cost_amount. They are partial because only settled order records that have been imported are available, and can represent signed adjustments. No changes to Supabase schema or environment variables.

Estimated profit still uses product sales - 6% fees - saved COGS and excludes shipping, refunds and other expenses. Do not treat it as final net profit.

No live TikTok or production build validation completed. Back up the current site and verify Vercel deployment after commit.
