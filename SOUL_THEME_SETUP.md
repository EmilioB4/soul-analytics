# Soul Analytics — Iridescent logo theme

This package is based on the existing Dashboard Revamp. It changes branding and styles only, leaving the existing TikTok endpoints and database schema intact.

## Installation
1. Keep a backup of your currently working GitHub repository.
2. At the repository ROOT (not inside a new folder), update the following files:
   - `app/page.tsx`
   - `app/globals.css`
   - `public/soul-iridescent-logo.jpg`
3. Commit changes. Vercel should build a new deployment.
4. Confirm login, sidebar branding, graph and Product & COGS/Finance/Orders tabs function.

No new Supabase SQL or Vercel environment variables are required.
If you have made changes to app/page.tsx or globals.css since installing Dashboard Revamp, compare changes before overwriting.
