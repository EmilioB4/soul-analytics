SOUL ANALYTICS — REAUTHORIZATION FIX (2 files only)

This ZIP is a small patch, NOT the complete project.

1. Back up your current GitHub repository (Code > Download ZIP).
2. Extract this ZIP. In your GitHub repo root, update these EXACT paths:
   app/api/tiktok/callback/route.ts
   app/page.tsx
   Do not upload a top-level folder called soul-tiktok-reauthorize-fix or the ZIP itself.
3. Commit these two file replacements. Wait for Vercel Production Ready.
4. Sign in at https://soul-analytics.vercel.app.
5. Click Reauthorize TikTok Shop (important: use THIS website button,
   NOT the Copy authorization link from Partner Center). This starts the
   short-lived, signed browser session needed for security.
6. Approve the TikTok authorization and return to the dashboard. You should
   see a success or failure message.
7. Check Supabase tiktok_connections.updated_at (UTC), without exposing tokens.
   Only retry order sync after it has updated.

Security notes: TikTok Seller authorization can omit the optional state
parameter on redirect. This patch accepts a missing state ONLY when the
browser presents the valid, short-lived, HttpOnly, signed session cookie
created by the dashboard's /api/tiktok/start route. If state is supplied,
it must match. A missing cookie is always rejected. On reauthorization, a
different seller ID is rejected instead of silently replacing the account.

Limitation: When TikTok omits state, protection against authorization-code
substitution is weaker than a fully state-echoing OAuth flow. Keep the
10-minute window, signed cookie and same-seller check. Never remove them.

This code is not live-tested against TikTok, and it does not fix unrelated
API-permission failures. It does not create/alter Supabase tables or env vars.
