SOUL ANALYTICS — PROFIT & EXPENSES TAB CLEANUP

This is a one-file frontend update.

Changes:
- Renames Financials to Profit & Expenses in sidebar and page heading.
- Removes duplicate Products & COGS component from the Financials tab.
- Adds a distinct financial breakdown with priced-product sales, 6% modeled TikTok fees, saved COGS/FIFO costs, recorded net seller shipping and estimated contribution profit.
- Adds profit margin, SKU/shipping coverage, explicit partial-data warnings and a shortcut to Products & COGS.
- Enables existing date filters on the new Profit & Expenses tab.

Preserved:
- Products & COGS tab and existing product editing
- Payouts tab
- TikTok connections, order sync, FIFO backend, Stream Summary card
- Existing SQL schema and Vercel settings

INSTALL:
1) Ensure FIFO & Payouts updates have already deployed. This page.tsx is based on the Payouts-tab version of the site.
2) In your GitHub repository's root, upload the app folder from this ZIP (the path must be app/page.tsx, not an extra nested folder).
3) Commit, check Vercel deployment and test the new Profit & Expenses tab.

No Supabase or Vercel configuration changes.
Profit remains an estimate, not accounting net profit. Some order costs may be missing; the display labels those limitations.
TypeScript syntax was checked; complete Next.js production compilation and live data rendering were not verified.
