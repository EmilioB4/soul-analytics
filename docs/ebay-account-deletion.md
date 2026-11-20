# eBay Marketplace Account Deletion setup

This endpoint must be deployed and configured before submitting its URL to eBay. It is separate from the OAuth callback, RuName and CRON_SECRET. It works without a RuName so eBay can activate the Production keyset first.

## One-time administrator setup

1. Merge/deploy the account-deletion update to the existing **soul-analytics** Vercel project. Preserve its existing Supabase configuration and encryption key.
2. In that site's Supabase SQL Editor, run the entire `supabase/ebay_account_deletion.sql` after the existing `supabase/ebay_setup.sql`. It affects only eBay tables. Run it in the main site's database, not the testing database.
3. Generate a private verification token in Windows PowerShell with this single line. It generates a 64-character random hexadecimal token and copies it to your clipboard without printing it:

   ```powershell
   $b = New-Object byte[] 32; $r = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $r.GetBytes($b); $r.Dispose(); ([BitConverter]::ToString($b)).Replace('-', '').ToLowerInvariant() | Set-Clipboard
   ```

4. In the main Vercel project's Production environment, add `EBAY_DELETION_VERIFICATION_TOKEN` and paste that token. Keep `EBAY_APP_URL=https://soul-analytics.vercel.app`, `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` set to the Production application credentials. Do not use NEXT_PUBLIC variables. Redeploy after saving.
5. In eBay's Production Notifications settings select Marketplace Account Deletion and keep exemption off. Use:

   - Endpoint: `https://soul-analytics.vercel.app/api/ebay/account-deletion`
   - Verification token: the **same token** pasted into Vercel.
   - Alert email: an address you monitor.

6. Save. eBay sends a GET challenge; the endpoint replies with the configured SHA-256 challenge response. Run eBay's Send Test Notification and confirm acceptance. A browser visit without `challenge_code` deliberately returns 400 and does not test a notification.
7. Once Production access is active, complete the OAuth redirect/RuName instructions in `docs/ebay-setup.md`. Each user then connects through the website; only the administrator performs this setup.

Do not paste private credentials, the verification token, notification payloads or seller tokens into chat/screenshots. Real eBay challenge and signed delivery still need to be verified after deployment. A passing local test does not confirm hosted setup or keyset activation.

## Processing behavior

- GET hashes `challenge_code + verification token + exact configured endpoint` in that order; request Host headers do not change the endpoint.
- POST verifies the eBay signature using eBay's fixed Production public-key API and an application access token. Public keys are cached for one hour with a bounded cache. ECDSA/SHA-1 and JSON serialization match the official eBay Node SDK. The verification token is used for endpoint challenges, not as proof a POST came from eBay.
- Unsigned/invalid messages receive 412. Upstream or database failures receive 503 so eBay can retry. Requests are limited to 64 KiB. No raw payload, identity, token or provider error is logged/returned.
- A service-role-only transaction deletes this immutable eBay userId's connections, orders and costs across all Soul users, including history retained after disconnect. It clears pending OAuth states for currently linked owners. It preserves Soul login accounts/profiles, other eBay sellers and other platforms/bank records.
- One-way account fingerprints block late OAuth callbacks, cost writes and sync results from restoring deleted records. They contain no raw seller ID, username, credentials or notification payload. Repeated delivery is idempotent.
- A 204 acknowledgement is sent only after the verified transaction commits; the application does not acknowledge and then rely on a process that may stop after the response. Deadlock/temporary database failures remain retryable.

## Operations and retained copies

Monitor eBay's alert email and failed deliveries. Any additional eBay storage introduced later must be added to cleanup. Existing external exports, independent backups and previously downloaded reports are not erased by a database row deletion; review their retention and deletion separately. If restoring a database backup, preserve/reapply deletion fingerprints and replay the affected deletions before serving traffic. Do not claim legal compliance or permanent erasure of backups based only on this endpoint.

## Validation

```sh
node --experimental-strip-types --test tests/ebay-deletion.test.mjs
node scripts/validate-ebay-deletion.cjs
npm run build
```

Sources: [eBay deletion guide](https://developer.ebay.com/marketplace-account-deletion), [official eBay notification SDK](https://github.com/eBay/event-notification-nodejs-sdk/blob/main/lib/validator.js), [SDK signature algorithm and Production endpoint](https://github.com/eBay/event-notification-nodejs-sdk/blob/main/lib/constants.js).
