# Soul Analytics — Secure Chase connection (Plaid)

## Install order

1. In Supabase **SQL Editor** (Database role, not Logs), run `supabase/plaid_bank.sql`. This creates the encrypted-token record table and bank transaction table, with row-level security **enabled** and no public policies. If your editor only permits one statement, run each `CREATE TABLE`, `ALTER TABLE`, and `CREATE INDEX` separately.
2. In Vercel → Soul Analytics → Settings → Environment Variables (Production), you already added `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `PLAID_ENV=production`.
3. **Add a new secret** `PLAID_TOKEN_ENCRYPTION_KEY`: generate a random 32-byte value encoded as 64 hex characters (PowerShell: `$b=New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [BitConverter]::ToString($b).Replace('-','').ToLower()`). Store a backup in your password manager. Never paste it into a chat or GitHub. Losing it makes stored bank tokens unreadable.
4. For seamless Chase OAuth across browser and mobile, in Plaid Dashboard → Link → Allowed redirect URIs add `https://soul-analytics.vercel.app/plaid/oauth`, and in Vercel add `PLAID_REDIRECT_URI` = `https://soul-analytics.vercel.app/plaid/oauth` (Production, Config). They MUST match. Without this optional variable, Plaid Link uses a browser popup, which usually works on desktop web but might fail in embedded browsers.
5. Upload ONLY the provided root-relative `app/` and `lib/` contents to your GitHub repo root, plus `supabase/plaid_bank.sql` if desired. Do not upload any `.env` or credentials. GitHub paths should be `app/PlaidBank.tsx`, `app/plaid/oauth/page.tsx`, `app/api/plaid/...`, `app/page.tsx`, `lib/plaid.ts`.
6. Commit and wait for Vercel **Ready**. Go to Payouts → **Connect Chase with Plaid**. Authorize the correct business checking account, then choose the checking account if prompted. Click **Sync Chase deposits**.

## What is and is not connected

- This uses Plaid **Transactions** read-only data. No payment initiation, transfers, bank passwords, or complete account numbers are handled by Soul Analytics.
- A **potential TikTok deposit** is a *posted incoming transaction whose description resembles TikTok / Pipo / ByteDance*. It is **not** a verified match with a TikTok payout. Do not treat the candidate total as confirmed matched payouts or profit.
- TikTok can combine streams in one deposit, settlement dates and bank dates differ, and Plaid updates may lag. Per-stream payout reconciliation still requires TikTok payout reference identifiers and a deterministic matching process.
- The current implementation imports on demand when you click **Sync Chase deposits**; no recurring jobs or webhooks yet. Use **Disconnect** to revoke Plaid access and delete local imported bank transactions.

## Security checklist

- Plaid API calls and access-token encryption happen only on the server; Supabase owner checks are required for every route.
- Database RLS is enabled and there are no browser-readable policies.
- Do not post screenshots revealing Plaid access tokens, secrets, OAuth callback parameters or bank details.
- For business use, review Plaid authorization terms, data retention, and your privacy practices before connecting real accounts.

## Troubleshooting

- Plaid `INVALID_REDIRECT_URI`: add `https://soul-analytics.vercel.app/plaid/oauth` to Plaid's Allowed redirect URIs and set the matching Vercel environment variable, then redeploy.
- Plaid `PRODUCT_NOT_READY` or no transactions: Plaid may still be loading historical transaction data. Retry Sync later, or add webhooks in a future release.
- Plaid `PRODUCTS_NOT_SUPPORTED`: ensure Plaid Transactions is enabled for your Production account and Chase account.
- Missing table errors: verify the SQL migration ran successfully.

This was statically checked; please verify the production deployment and a real Chase Link authorization before relying on live bank results.
