SOUL ANALYTICS - TIKTOK SHOP REVENUE OVERVIEW + PROFIT CARDS

Upload the contents of this package to the ROOT of your existing GitHub repository, not into a new subfolder.

Changed files:
  app/page.tsx
  app/globals.css
  app/api/analytics/route.ts
  app/ProductFinance.tsx
  app/api/tiktok/products/route.ts

Features:
- Sidebar navigation is labeled "TikTok Shop Revenue Overview".
- Overview and Orders metric cards show estimated TikTok fees (flat 6%) and estimated contribution profit.
- These amounts respect the chosen Today / This week / This month / Year to date period.
- Top Sellers lists an average unit sale price as well as quantity and revenue.
- Products & COGS uses the same 6% fee / saved-C0GS formula.

Estimated contribution profit = imported counted USD line-item sales with saved COGS - 6% estimated TikTok fees - saved SKU COGS.
Missing-cost products are excluded and flagged, and report pagination caps are flagged.
It is NOT bank payout, GMV, or accounting net profit. Refunds, shipping charges, affiliate commissions and other TikTok adjustments are not included.

No new environment variables or SQL migrations are required if product_finance.sql was already applied.
Do not upload secrets or environment files. Back up the repository and verify the Vercel deployment before testing.
This package has not been tested against live user data or a full Next.js production build.
