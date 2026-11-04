SOUL ANALYTICS — STREAM SUMMARY CARD / TOP 3 PROFIT ITEMS

Changes:
- The Stream Summary card now uses a more cinematic charcoal / iridescent look inspired by the Soul collectibles banner.
- The top-seller panel becomes TOP 3 PROFIT ITEMS, with straightforward sans-serif typography, normal numbers 1, 2, 3 (no wreaths), actual item imagery when available, units and estimated SKU profit.
- Top 3 ranked by (unit sale price × quantity × 0.94) − (saved unit COGS × quantity), for products with complete sale price and saved COGS. Shipping is NOT allocated to individual products; overall estimated profit still uses available shipping and remains partial when costs are missing.
- Same date filter, download PNG button, 1600×900 canvas, no new database tables, secrets, or dependencies.

INSTALL
1. Extract this ZIP.
2. In your private GitHub soul-analytics repository, on main at the repository root, choose Add file > Upload files.
3. Upload the extracted app folder; GitHub should show only:
      app/StreamSummaryCard.tsx
      app/api/analytics/route.ts
4. Commit, wait for Vercel status Ready, hard refresh the site.
5. On Overview, choose your dates, inspect the card, then Download PNG.

Do not upload the ZIP itself. Do not replace your other project files.

VALIDATION
TypeScript source parsed/transpiled without syntax diagnostics. A full Next.js production build and live rendering are not verified here.
