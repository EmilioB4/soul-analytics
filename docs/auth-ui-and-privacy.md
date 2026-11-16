# Authentication UI and account isolation

Sign-in, signup and password recovery now share a responsive Soul card, smaller branding, consistent fields/focus styling and gradient actions. Account messages appear as dismissible bottom-left notices. Errors remain visible until dismissed; repeated attempts can display a fresh notice. Toasts use alert/status semantics and respect reduced motion. Password recovery has confirmation, a session check, loading/submission states and a success screen; invalid sessions cannot submit a password update.

## Account boundaries

The sign-in flow checks that Supabase returned the email explicitly entered. It holds dashboard authorization while this identity check completes, rather than accepting an earlier auth event. A mismatched/missing identity is rejected and its local session is removed. In-flight account checks are invalidated on sign-out and session changes; stale responses cannot authorize a previous user's dashboard. On account switching the existing full-page reload clears dashboard state. The sidebar displays the signed-in user's email. Signing out clears the local session without signing out every other device.

The underlying protections remain authenticated server routes, owner-filtered data access, encrypted private marketplace credentials and the restrictive tenant database policies from multiuser_foundation.sql (also included in walmart_test_setup.sql). This UI change does not weaken or replace them. No database migration, credential change or new environment variable is required.

## Validation

`node --experimental-strip-types --test tests/*.test.mjs` includes identity mismatch, invalid-password and stale-access tests, plus existing authenticated registration, credential-ownership and API tests. `npm run test:isolation` uses synthetic users in in-memory PostgreSQL to check owner-specific reads/writes, denied private credential access and self-admission, older permissive policies and migration reruns. Browser checks cover notices, password confirmation/success, expired links and desktop/mobile layout using mocked authentication responses.

Production database permissions, real reset-email delivery and live provider account separation cannot be verified without access to that project. Before public use, repeat the two-real-user check in docs/multiuser-foundation.md using separate browser profiles: each starts with their own empty Walmart dashboard, connects their own credentials and sees only their own imported orders, costs, inventory and payout history. Check sign-out and account switching as part of that exercise. Do not share password-reset links or credentials while testing.
