Soul Analytics — searchable product selector with images for FIFO Inventory Purchase Batches

Only replace this file in GitHub repository root:
  app/InventoryBatches.tsx

Changes:
- Product dropdown is replaced with searchable product list.
- Each product shows its imported TikTok thumbnail (when available), name, variant, and SKU.
- The selected product also shows its thumbnail.
- Existing batch creation, edits, deletion, FIFO logic, COGS calculations, database tables, and other pages are unchanged.
- Product image uses the existing image field in the products response; missing images use a simple placeholder.

Steps:
1. Extract the ZIP.
2. In your GitHub repository root, Add file > Upload files.
3. Drag the app folder from the ZIP. Verify path app/InventoryBatches.tsx.
4. Commit and check Vercel Deployments > Ready.
5. Open Products & COGS > Manage batches and click the Product selector.

Do not upload a containing parent directory or ZIP into GitHub.
No Supabase migration, API change or Vercel variable is needed.

Validation: TypeScript/TSX syntax parser passed; full Vercel build and production testing still required.
