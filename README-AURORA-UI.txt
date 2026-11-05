SOUL ANALYTICS — AURORA UI REDESIGN

Extract ZIP. Upload ONLY app/ and lib/ folders to root of GitHub repo (not nested).
Modified: app/page.tsx, app/globals.css, app/WhatnotDashboard.tsx, lib/whatnot-finance-summary.ts.
Official Soul wordmark uses existing public/soul-wordmark-transparent.png (already in repository).
Whatnot show date uses earliest imported ORDER_EARNINGS completed_at. This is the first financial sale date, not verified show start time.
Whatnot figures in Combined Analytics are all imported dates; TikTok figures follow the selected date filter. They are not summed across incompatible windows. Comparison chart remains TikTok-only until dated Whatnot bins exist.
No SQL changes required. Existing financial calculations preserved.
Revert the single GitHub commit if needed. Vercel build requires verification.
