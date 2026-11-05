SOUL ANALYTICS - PLATFORM NAVIGATION (PHASE 1)

What changes:
- Sidebar groups: Combined Analytics / TikTok Shop / Whatnot / Integrations.
- Combined Analytics shows clearly labeled TikTok-only live figures and an empty Whatnot card until Whatnot data is imported.
- Whatnot gets a clean setup landing page for the next phase (generic listing profit tracking).
- TikTok Shop Orders, Products & COGS, Profit & Expenses, Payouts, Share PNL, integrations, and theme switch remain in the same page.

What does NOT change:
- No database changes, new tables, API changes, or changes to costs/profit computations.
- No Whatnot import or combined totals yet. Those are phase 2.

Install:
- Extract this zip.
- Upload the CONTENTS of the app/ folder to the app/ folder at your GitHub repository root. Replace ONLY app/page.tsx and app/globals.css.
- Do NOT upload the ZIP or a nested project folder.
- Commit and wait for Vercel Ready.

Revert:
- GitHub -> Commits -> revert this commit (or restore the two prior versions).

Validation:
- TypeScript TSX syntax/transpilation checked. Full Next.js production build not tested here.
