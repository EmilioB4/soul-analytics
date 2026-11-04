# Soul Analytics — TikTok Shop authorization

This build implements seller authorization, server-side code exchange, and encrypted storage of TikTok Shop access and refresh tokens. **It does not yet synchronize orders, fees, refunds, or settlements.**

## Before deploying
1. In Supabase SQL Editor, run `supabase/tiktok_connections.sql`.
2. In Vercel Environment Variables (Production), keep `TIKTOK_SHOP_APP_KEY` and `TIKTOK_SHOP_APP_SECRET` (server-side; no NEXT_PUBLIC prefix).
3. Add `SUPABASE_SERVICE_ROLE_KEY` using Supabase Project Settings > API Keys. Keep it server-only and private.
4. Generate a random 32-byte key (64 hex characters) and set `TIKTOK_TOKEN_ENCRYPTION_KEY` in Vercel; **store a backup securely**, as losing it makes stored tokens unreadable. Example terminal command: `openssl rand -hex 32`.
5. In TikTok Shop Partner Center, click **Copy authorization link** (Seller), then paste the **full HTTPS link** as `TIKTOK_SHOP_AUTH_URL` in Vercel. This is a server-side variable.
6. Verify the TikTok app Redirect URL is exactly `https://soul-analytics.vercel.app/api/tiktok/callback`.
7. Redeploy after setting variables. Sign into Soul Analytics and click Connect TikTok Shop.

If TikTok returns an error or does not preserve the state query parameter, stop and report it; do not share codes or tokens. No orders are imported yet. Tokens are encrypted before storage, with the encryption key kept in Vercel.

## Upload safely
Unzip this archive. From the repository **root**, upload the **contents** of the `soul-analytics` folder, not the containing folder itself. GitHub must show `app/`, `lib/`, `supabase/`, `package.json` directly at root. Do not upload secrets, `.env` files, or a ZIP into GitHub.
