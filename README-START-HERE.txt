SOUL ANALYTICS - SALE PRICE & AUCTION ANALYTICS (REVERSIBLE)

Includes ONLY 3 changed code files:
  app/AuctionAnalytics.tsx                  NEW expandable analytics feature
  app/ProductFinance.tsx                    Adds analytics under Products & COGS
  app/api/tiktok/products/route.ts          Adds per-sale FIFO COGS + 6% profit fields

INSTALL
1. In GitHub, use a NEW BRANCH from main if you want the safest preview, and deploy it to Vercel Preview first. Otherwise commit to main (you can still revert).
2. At repository ROOT, upload the app folder from this archive. Do not upload the containing directory.
3. Confirm exactly the 3 paths above, then commit.
4. In Vercel, verify deployment is Ready.
5. Open Products & COGS and expand "Sale Price & Auction Analytics" below the existing product table.

ROLLBACK
GitHub -> Commits -> find the feature commit -> Revert (or restore the previous versions of app/ProductFinance.tsx and app/api/tiktok/products/route.ts, then delete app/AuctionAnalytics.tsx). Reverting the commit restores previous behavior without deleting orders or FIFO lots.

BEFORE YOU TRUST THE NUMBERS
- Order imports do NOT verify auction versus fixed-price. The feature analyzes ALL eligible imported item sales.
- Per-sale estimated profit = item subtotal - 6% TikTok fee - FIFO-allocated/fixed COGS.
- Historical per-sale profit EXCLUDES shipping, refunds, affiliate commissions, taxes and other adjustments.
- FIFO purchase batches allocate historically and must be complete/accurate.
- Missing COGS leaves profit blank; it does not count as zero.
- Results are limited to the existing 5,000-row API query cap and latest 100 displayed sale lines.
- The break-even calculator shipping input is a WHAT-IF scenario, not a historical accounting deduction.
- This patch changes no SQL tables, bank/Plaid settings, payout logic, or actual COGS entries.

Validation: ZIP integrity and TypeScript TSX syntax transpilation performed; full Next.js production build and live-data verification not completed.
