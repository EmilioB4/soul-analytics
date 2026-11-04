SOUL ANALYTICS — STREAM SUMMARY CARD REFINEMENT

This update contains ONE file:
  app/StreamSummaryCard.tsx

Changes:
- Shrinks the Soul logo and adds more visual separation above STREAM SUMMARY.
- Replaces thin colored bars on the four stat cards with canvas-drawn sales, profit, units, and orders icons; these also export in the downloaded PNG.
- Adds subtle, low-opacity feather/leaf accents in the upper-right and lower-left corners, inspired by the Soul logo.
- Preserves current financial calculations, date filters, live data loading, and PNG export behavior.

Install:
1. At the root of https://github.com/EmilioB4/soul-analytics choose Add file > Upload files.
2. Drag the app folder from this extracted ZIP into GitHub's upload area.
3. Confirm the path is app/StreamSummaryCard.tsx and commit.
4. Let Vercel deploy; check that deployment says Ready.
5. Refresh the Overview and click Download PNG to check exported styling.

No database changes or environment variables are needed.
TypeScript transpilation check passed. Live production build and rendering have not been verified here.
