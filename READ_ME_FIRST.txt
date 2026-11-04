SOUL ANALYTICS — 6% PROFIT ESTIMATE PATCH

Upload ONLY these two updated files to the ROOT of your EXISTING GitHub repository:
  app/ProductFinance.tsx
  app/api/tiktok/products/route.ts

Do not upload the enclosing soul_profit_patch folder itself. Keep all other files,
existing TikTok authorization, SQL tables, and Vercel secrets unchanged.

The revised Products & COGS and Financials views show:
- product sales subtotal for imported, priced products
- estimated fee at 6% of those sales
- total saved COGS
- estimated contribution profit = sales - estimated fee - COGS
- average sale price and estimated profit per product

IMPORTANT:
- This is an ESTIMATE and does not include real shipping costs, affiliate fees,
  refunds, platform fee adjustments, or overhead.
- It excludes UNPAID and CANCELLED order statuses, not necessarily refunded orders.
- SKUs without recorded costs or sale prices are excluded and are counted.
- Costs are assumed constant across historical orders for a SKU.
- The 5000 row limit could make totals incomplete on large histories.
- The "Import settled fees" backend API remains available but this widget no longer
  displays the unreliable partial settlement-derived profit figure.
- No database migration or additional environment variables required.
- Commit to main; check Vercel production build before using the figures.
