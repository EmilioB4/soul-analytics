# TikTok Shop integration — implementation status

This release preserves the working Supabase login, improves the dashboard, and adds authenticated server-side routes and a **safe authorization scaffold**.

## Important: not yet a completed TikTok connection

The `Connect TikTok Shop` button checks the logged-in owner and creates a short-lived, HTTP-only OAuth state cookie. It will **not** be able to connect a shop until the correct TikTok Shop authorization URL and its redirect/state behavior have been verified against current Partner Center documentation. The callback deliberately **does not exchange authorization codes or store access tokens**. It only validates state and redirects back to the dashboard. Do not claim a shop is connected until a verified token exchange and persistent encrypted token storage are implemented.

## Deployment

1. Replace the repository files with this folder's contents and deploy to Vercel. Preserve existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `TIKTOK_SHOP_APP_KEY`, and `TIKTOK_SHOP_APP_SECRET`.
2. Add `SUPABASE_SERVICE_ROLE_KEY` as a **server-only secret** from Supabase project API settings. Never prefix it with `NEXT_PUBLIC_`, paste it into chat, or commit it to Git.
3. Run `sql/tiktok-connections.sql` in the Supabase SQL Editor. The table is private with RLS enabled and no client read policies.
4. Confirm the TikTok app is published/eligible and verify its official authorization endpoint, callback query parameters, scopes, and token exchange requirements. Only then set `TIKTOK_SHOP_AUTH_URL` to the verified authorization endpoint. Do not guess this URL.
5. Complete a secure token exchange, encrypted server-side token storage, token refresh, and order/settlement sync before expecting real financial metrics. The current version intentionally shows no unvalidated financial numbers.

## Security

Never send App Secret, service-role key, shop access tokens, or refresh tokens in chat or screenshots. The current `status` route reads only a connection indicator. OAuth state is validated, but provider-specific state handling must be verified before enabling a live authorization flow.
