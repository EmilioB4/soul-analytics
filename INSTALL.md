# Soul Analytics Premium Redesign

This is a three-file UI-only patch built against the current Soul Analytics page with the compact Payouts tab and official TikTok payout components.

Files:
- app/page.tsx: Share PNL button near Refresh; compact estimate note
- app/StreamSummaryCard.tsx: modal only (no giant card embedded in page)
- app/globals.css: near-black palette and Sora/Inter typography

Upload the `app` folder to the repository root, verify the paths, then commit. No Supabase migration or new environment variables.

Before committing, consider saving a GitHub revision or rollback point. If you have changed `app/page.tsx` after the Compact Payouts update, review the diff before replacing it.

The Share PNL button uses the existing reporting period and analytics results. It opens an accessible-labeled preview and allows PNG download. Existing image calculations are unchanged.

Full Next.js production build could not be completed offline: npm installation was unavailable in this environment. TypeScript/JSX syntax was checked. Verify the Vercel build and the PNG image export in the browser.
