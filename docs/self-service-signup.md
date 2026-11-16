# Self-service signup (test project first)

This release replaces manually inserting a profile for each new customer. No new SQL migration is needed if `supabase/multiuser_foundation.sql` has already run. Existing profiles and dashboards remain intact. Keep the database browser insert permissions closed: admission happens through the authenticated server endpoint.

## Test setup, in order

1. Use the separate testing Supabase project. Install the remaining dashboard table migrations before testing imports; account signup alone does not create order or inventory tables.
2. In Supabase Authentication → Sign In / Providers → Email, enable email signup and **Confirm email**. Depending on the UI version, signup may also be under Authentication → Settings → Allow new users to sign up. Keep email verification enabled. The server requires `email_confirmed_at`; that field is only meaningful as verification when automatic email confirmation is disabled in Supabase.
3. Use a separate Vercel testing project connected to the `feat/self-service-signup` branch, or branch-specific Preview environment overrides for every Supabase variable. Never change the live project's Production variables while setting up the test project. Configure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from the test project. Keep server credentials private. Existing encryption and background setup requirements still apply to marketplace imports.
4. Add server environment variable `SELF_SERVICE_SIGNUP_ENABLED=true` to that testing deployment, then redeploy. It is disabled by default when absent. No NEXT_PUBLIC version of this flag is required.
5. In the testing Supabase project → Authentication → URL Configuration, set Site URL to the stable test deployment URL. Add that exact URL with `/` and `/auth/update-password` to allowed Redirect URLs. Email confirmation links must return to the test site, not production. The existing Supabase browser client handles confirmation sessions in the URL.
6. On the test site's sign-in page choose **New here? Create an account**, enter an email and a password of at least 12 characters, then submit. Open the verification email, confirm, and sign in if prompted. The app creates that verified user's profile server-side and opens Connections & settings with a welcome message. No manual SQL profile insert is needed.
7. Repeat with a second real email/browser profile. Both dashboards must start empty, and each Walmart connection, inventory, job and payout preference must stay separate. Existing test-user logins must still work. Test invalid/expired confirmation links and duplicate signup without assuming the email delivery provider always delivers instantly.

Supabase default email delivery has restrictive limits and may restrict recipients. Configure custom SMTP in Authentication → Email → SMTP Settings before inviting public customers, and configure signup rate limits/CAPTCHA as appropriate to the project. This app does not replace Supabase email delivery or bypass its verification/rate limits.

## How admission is protected

- GET /api/accounts/register exposes only a boolean signup setting and is not cached.
- POST verifies the access token with Supabase, uses only that returned user's ID, and ignores caller-supplied IDs and metadata.
- Existing admitted users continue working if public signup is disabled.
- A new profile requires the server flag, an authenticated user, and a confirmed email. Profile creation is idempotent and never overwrites existing admission rows.
- Browser INSERT/UPDATE permissions on profiles remain revoked. Keep the existing restrictive tenant policies. Do not add a public profile-insert policy or an automatic trigger on every auth signup.
- Users can create a Supabase Auth identity directly if Supabase signup is enabled, but dashboard admission still requires the server flag. To close registration entirely, disable signup in Supabase as well as removing the server flag.
- This is public admission: deleting a profile is not a permanent account ban while self-service signup is enabled. Ban/delete the Auth user through Supabase for revocation; otherwise a confirmed user may enroll again. Existing in-flight requests may finish.

## Production rollout

Only after the two-account staging check passes, apply/verify all multiuser database policies in production, enable Supabase signup + Confirm email, configure production SMTP/redirect URLs, and set the Production SELF_SERVICE_SIGNUP_ENABLED flag followed by a redeploy. This development change does not enable live registration by itself. Marketplace app approvals, per-user Whatnot authorization, public terms/privacy requirements, and billing are separate release work.
