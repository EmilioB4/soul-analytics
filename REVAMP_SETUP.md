# Soul Analytics — Dashboard revamp

This is the full Next.js project based on Soul-Analytics-COGS-Finance.zip. It preserves existing TikTok authorization, order-sync, product-cost saving, and finance-sync endpoints.

## What's new

- Modern charcoal / mint-green design with desktop sidebar and mobile tabs.
- Overview, Orders, Products & COGS, Financials, and Integrations tabs.
- Actual sales-by-time chart using data already imported into Supabase.
- Today (hourly), This week (daily), This month (daily), Year to date (monthly) selectors.
- Top sellers using order-line SKU quantities and product images from existing imported records.
- Orders table with status and product subtotal.
- Authenticated `/api/analytics?period=day|week|month|ytd` reporting endpoint.

## Important financial caveats

- Chart and KPIs show *product sales subtotal*, not TikTok GMV, actual payout, or final profit.
- Counting excludes UNPAID and CANCELLED for sales subtotal, but imported-order count includes every status.
- YTD reports only show records that have **actually been imported**. Your existing button imports only the last 30 days, so older months may look blank until historical imports are built.
- Financials tab retains previous settled-finance importer and SKU COGS editing. It does not fabricate an account-wide net-profit amount.
- Analytics API returns a warning if its 20,000-order or 10,000-item pagination cap is reached.

## Deployment

1. Back up your current GitHub repository first.
2. Extract this ZIP and open its project root (where `app/`, `lib/`, `public/`, `supabase/` and `package.json` are visible).
3. Upload **contents** into the root of the `main` branch of your repository, not an enclosing folder or the ZIP itself.
4. If GitHub's web uploader refuses to replace existing files, edit/replace via Git or GitHub desktop rather than deleting the working project indiscriminately.
5. Check Vercel's Production deployment and verify the new tabs and data. Existing environment variables should continue to be used.

No new SQL statements or environment variables are needed for the visual redesign, assuming your existing COGS & Finance migration has already run.

## Test coverage

TypeScript/TSX syntactic transpilation verified. ZIP integrity verified. A complete Next.js production build and runtime integration test could not be completed because npm dependencies were unavailable in the current environment. Check Vercel build status before relying on the deployment.
