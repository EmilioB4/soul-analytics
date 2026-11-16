# Invite-only Walmart accounts: first release

This release lets admitted users sign in to their own dashboard and connect their own Walmart Client ID/Secret. It does not enable public registration or claim that TikTok/Whatnot app approvals are complete.

## Preserve the current dashboard

1. Back up the production database before applying permission changes. Test on a separate Supabase project and Vercel preview first; use test accounts and test marketplace credentials. Never point a test import at production data.
2. Preserve the existing primary user's `profiles` row and explicit `WALMART_OWNER_ID` (or existing private `payout_platform_owners` binding). Their Vercel Walmart credentials continue to work only for that owner. Do not remove those variables during this release.
3. If you use the shared Whatnot API token, set `WHATNOT_OWNER_ID` to the existing account UUID before inviting anyone. The release deliberately blocks other users from that shared connection.
4. Keep `TIKTOK_TOKEN_ENCRYPTION_KEY` unchanged. It must be 32 random bytes encoded as 64 hex characters. It encrypts existing TikTok tokens and the new per-user Walmart credentials. Rotating it without a migration breaks decryption.
5. Run `supabase/multiuser_foundation.sql` as an administrator. It preserves rows, adds a private credential table, restricts profiles to self-read, and adds restrictive tenant policies on UUID `owner_id` tables. Check custom database policies/triggers in the live project before release; local source cannot reveal changes made directly in Supabase.
6. Deploy this branch. Check the original dashboard totals, inventory, TikTok, bank connections, background imports, and Discord preferences against the pre-release baseline.

## Invite a test user

Keep public signups disabled in Supabase Authentication settings. Create the invited user through Supabase Authentication → Users using the supported invite/create flow. The existing password login and password reset page are retained. Configure Supabase's allowed redirect URLs for the deployment. An auth user alone has no dashboard access.

After creating the auth user, explicitly admit that UUID in SQL Editor:

```sql
insert into public.profiles(user_id)
values ('REPLACE_WITH_INVITED_AUTH_USER_UUID')
on conflict(user_id) do nothing;
```

If your existing profiles table has additional required columns without defaults, supply them too. Do not add a public insert policy, metadata-based admission, or automatic signup-to-profile trigger. Review any existing admission triggers before inviting users.

The user signs in, opens Connections & settings → Walmart connection, and supplies their own Marketplace API credentials from Walmart API Key Management. The server validates the credentials before storing them encrypted. Responses contain status only. Do not send keys via chat or commit them to GitHub.

Once connected, Start / repair automatic updates enables that user's order imports and saved payout alerts. Each request selects credentials and writes data using the authenticated user's ID; background jobs use their existing owner-scoped leases. Existing global scheduler configuration remains server-controlled. A user cannot select another owner in the connection API. Settlement and WFS endpoints also use the same per-user credential lookup.

## Repeatable local isolation checks

After `npm install`, run `npm run test:isolation`. This uses in-memory PostgreSQL with synthetic users, deliberately permissive older policies, and no network credentials. It checks cross-user reads and writes, blocked self-admission and credential access, denied TRUNCATE, migration reruns, key uniqueness, immutable account identity, secret rotation, and disabling scheduled work when admission is removed. API and import tests run with `node --experimental-strip-types --test tests/*.test.mjs`.

## Required two-account release check

Use separate browser profiles for the original owner and a newly invited test user. Verify the new dashboard starts empty and displays neither original inventory nor costs nor payout history. Connect different Walmart credentials and import; verify only that user's dashboard changes. Verify both users' background jobs select their respective credentials and webhook preferences. Confirm the new user cannot fetch the original user's rows directly via Supabase REST, cannot insert their own admission profile, and cannot read any credential table. Repeat after sign-out and sign-in. No live two-account test was possible from the development environment; complete it before inviting real customers.

## Boundaries of this first release

- One Walmart connection per user. Existing Client IDs cannot be silently replaced with another account; this protects dashboard history. Secret rotation with the same Client ID is supported. Full disconnect/deletion and account switching need a separate lifecycle change.
- Shared Vercel Whatnot credentials are restricted to `WHATNOT_OWNER_ID`. New users cannot import from that shared source. Per-user Whatnot authorization is a future phase.
- TikTok's existing owner-scoped OAuth storage remains. Public distribution and authorization approval requirements need separate verification.
- The same Client ID cannot be linked to multiple users, but seller identity across different API keys is not verified. This is a private credential connection, not a newly approved Walmart OAuth marketplace app.
- No billing, teams, public signup, workspace sharing, or owner-admin UI is introduced.
- Scheduler throughput, rate limits, and per-user retries need load testing before scaling beyond a small invite-only pilot.

## Rollback

Revert the application deployment if needed; keep the new table and restrictive policies. Do not drop credential data or weaken isolation to roll back. Existing legacy owner credentials are preserved. Deleting a profile blocks interactive API access and disables future order jobs and payout checks through a database trigger. In-flight requests may finish; revoke the marketplace keys as well if immediate credential revocation is needed.
