SOUL ANALYTICS - PRODUCT ORDER DROPDOWNS

Upload the app folder to the ROOT of your existing soul-analytics GitHub repository (NOT inside a new folder). The updated files are app/ProductFinance.tsx and app/api/tiktok/products/route.ts. Do not upload the ZIP itself.

Each SKU row now has an Orders (N) button that expands its imported counted order lines with date, order ID, status, quantity, unit price and product subtotal. No new SQL or environment variables are required. Current API returns up to 5000 order lines, and excludes UNPAID/CANCELLED from the product calculation. This does not show buyer personal data.

This patch is based on the Shipping & Profit Update version. If you have made newer changes directly to either of these two files, back them up/compare before deploying.
