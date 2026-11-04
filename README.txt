Soul Analytics — Dropdown build fix

Fixes the TypeScript compile error at app/api/tiktok/products/route.ts line 32 by giving the product row an explicit Prod type, including the orders: OrderDetail[] array.

Upload ONLY the app/ folder from this ZIP at the ROOT of your GitHub repository; the only changed file is:
app/api/tiktok/products/route.ts

This does not change Supabase, TikTok credentials, or dashboard UI.
Once committed, check the newest Vercel deployment. If another build error appears, share the first red TypeScript error.
