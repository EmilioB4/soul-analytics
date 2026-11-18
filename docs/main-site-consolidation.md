# One shared site: https://soul-analytics.vercel.app

The goal is one deployment and one shared database, with private dashboards for each user. Personal platform credentials and imports belong in the dashboard. Shared application credentials and infrastructure still require a one-time administrator setup.

## What can be done from the dashboard

- TikTok Shop: Connect TikTok Shop in Integrations, then import orders and financial records using existing dashboard actions. The site administrator still configures the TikTok developer app once. Each seller authorizes their own shop.
- Walmart: enter your own Client ID and Client Secret in Integrations, then use the Walmart sync actions and COGS editor. Users do not change Vercel variables.
- Whatnot: run `supabase/whatnot_connections.sql` once on the shared database. Each user can then verify/save their own Whatnot personal token in Integrations or Whatnot Overview. The token is encrypted, its seller identity is verified, and replacements must match that seller. Sync orders and Sync financials use that owner's token. Financial reports are asynchronous and may need another cycle. Automatic order syncing can be enabled from the existing dashboard controls. The old explicitly owner-bound Vercel connection remains available for compatibility until saved in the dashboard; it is never exposed to other users. Old dedicated daily Whatnot cron routes remain legacy-only; per-user order jobs use the shared automatic-order scheduler.

## Confirmed current projects

The original main database is `ljhamizriulyvenuielo`; the testing database is `ehpmupoptkoglbixczjg`. These are public project references, not secrets. Reconfirm configuration before any transfer.

## Approved direction: testing into main; preserve Soulshop

The user explicitly chose to keep Soulshop and all original-main records in their current database. The earlier proposal to point main at the testing database is CANCELLED. Do not move Soulshop data or change the main site's Supabase URL, public key, service-role key or encryption key.

- SOURCE: testing database `ehpmupoptkoglbixczjg`, containing the three testing users.
- TARGET: existing main database `ljhamizriulyvenuielo`.
- Preserve every existing Soulshop record and its account in place. Never include Soulshop as a source or target in the friends' owner mapping.
- Friends create and verify separate accounts on https://soul-analytics.vercel.app using the SAME email addresses as testing. New passwords are acceptable. Existing testing passwords are not copied.
- If Create account is missing, the administrator enables SELF_SERVICE_SIGNUP_ENABLED=true for Production on the MAIN Vercel project and redeploys. Also verify Allow new users to sign up is enabled in the MAIN Supabase Auth settings. This is a one-time admin setup, not a per-friend Vercel task.
- Read the new main user IDs only AFTER those accounts exist. Map each testing user to their own main user with the exact same verified email. Do not use confirmDifferentEmails for this transfer and never map a friend to Soulshop.

Do not delete either project or disable testing until the friends' imported records are verified on main. Main stays on its existing database throughout this process.

Run `supabase/consolidation_inventory.sql` in both projects' SQL Editors to identify users and table schemas. Keep these results private. Confirm that the TARGET has the application's current SQL migrations installed, including the new Whatnot connections migration. Do not run destructive reset scripts. Missing/incompatible target tables stop the preview.

## Preview-first administrator transfer

This is an OFFLINE administrator utility, not a browser/Vercel API. It requires database-owner access to both projects; this repository/GitHub access alone cannot move live data. Run it locally with Node and `npm install`.

1. Back up BOTH Supabase projects through your usual database backup process. Keep the original source intact. Review every admitted testing user and their correct verified main account. Soulshop is not part of this mapping.
2. Create a PRIVATE owner-map.json file outside the repository:

```json
[
  {"sourceId":"SOURCE-USER-UUID","targetId":"TARGET-USER-UUID"}
]
```

Include every admitted source user and every owner who has stored records. The tool fails on omitted owners, unverified/missing accounts or conflicting records. For this transfer, emails MUST match exactly (case-insensitive). Do not set confirmDifferentEmails. Never guess ownership from equal UUIDs or assign any friend’s history to Soulshop.

3. Set these LOCAL process environment variables using a secure password manager/terminal. Never paste them into chat or commit them:

- MIGRATION_SOURCE_DATABASE_URL: TESTING PostgreSQL connection string (`ehpmupoptkoglbixczjg`).
- MIGRATION_TARGET_DATABASE_URL: existing MAIN PostgreSQL connection string (`ljhamizriulyvenuielo`).
- MIGRATION_SOURCE_ENCRYPTION_KEY: TESTING project's existing TIKTOK_TOKEN_ENCRYPTION_KEY.
- MIGRATION_TARGET_ENCRYPTION_KEY: MAIN project's existing TIKTOK_TOKEN_ENCRYPTION_KEY. Do not replace this key; the script re-encrypts incoming secrets with it.
- MIGRATION_BACKUP_PASSPHRASE: a private random passphrase of at least 20 characters for the encrypted emergency snapshot created before applying.

Use the Supabase connection pooler's session mode if direct database networking is unavailable. TLS certificate validation is enabled; set MIGRATION_CA_FILE to the appropriate Supabase CA PEM file if needed, rather than disabling TLS verification.

4. Generate a read-only preview:

```text
node scripts/consolidate-supabase.cjs --mapping /PRIVATE/owner-map.json --plan /PRIVATE/main-transfer-plan.json
```

Review table row counts, pending inserts, conflicts, targetKeyVerified and ALL ignored table names. The key is checked against saved target credentials. If the target genuinely has no encrypted credentials yet, configure its key deliberately and use --confirm-new-target-key when applying; do not use this override to bypass a failed key verification. The plan includes account IDs and schema metadata, not tokens or financial rows. It must have zero conflicts. A conflict is not silently overwritten; compare records with an administrator and decide how to reconcile them first. Public tables without owner_id, global platform bindings, auth accounts, profiles (handled separately), OAuth sessions and global scheduler/Vault data are not copied. Investigate any ignored legacy statistics table before declaring the transfer complete.

5. Plan a cutover window. Close old editing sessions and pause scheduled jobs for the source. Leave the MAIN Vercel project's existing Supabase URL, public key, service-role key and encryption key unchanged. Testing is only the read-only source of the friends' records; no main data is exported to testing. Use the same shared developer app credentials as the copied OAuth connections; if developer apps differ, reconnect the affected platform on the main site. Recheck callback URLs, Supabase Auth Site URL/redirect allowlist, SELF_SERVICE_SIGNUP_ENABLED, PAYOUT_APP_URL and EBAY_APP_URL for the main address. Friends authorize their own marketplace connections in the main dashboard if reauthorization is needed. Do not replace Soulshop’s connections or credentials.

Regenerate and review the preview immediately before apply because live imports can change it. Apply requires that exact database fingerprints and data digest still match. During apply, source owner tables are SHARE-locked in a READ ONLY transaction, preventing new source edits while records are read. Target owner tables are locked in a serializable transaction. A busy lock times out safely; do not force-kill other application transactions to make it pass.

6. Apply the reviewed transfer, using a NEW backup filename:

```text
node scripts/consolidate-supabase.cjs --mapping /PRIVATE/owner-map.json --apply --reviewed-plan /PRIVATE/main-transfer-plan.json --backup /PRIVATE/main-transfer-source.enc
```

The script makes an encrypted compressed source-record snapshot before target writes, remaps only approved owner IDs, re-encrypts saved connection/webhook fields, preserves source generated-ID audit content with newly allocated target IDs, resets leases, and inserts missing records in foreign-key order. Existing target rows are never overwritten. Every imported record is checked before committing; an error rolls back the target transaction. Incoming automation preferences are disabled and interrupted `sending` alerts become `uncertain` to avoid duplicate Discord messages. Source application records are never written/deleted. This is additive import, not a destructive database restore.

The encrypted snapshot envelope is `SOUL-MIGRATION-1\n` followed by a 16-byte scrypt salt, 12-byte AES-GCM IV, 16-byte authentication tag, and gzipped JSON ciphertext. Retain the passphrase and original source encryption key securely. There is no automated post-commit rollback; retain both full database backups and the original source database until verification is complete.

7. Verify with both your account and a friend on the MAIN address: historical totals for matching dates, product costs, inventories, refunds, bank/payout records and saved connection identities must match the intended owners. Use the read-only preview again to check that no unreviewed rows remain. Reconnect any legacy environment-only accounts through Integrations. Those environment variables are not database records and are not copied by this tool.
8. After verification, use Start / repair automatic updates and the Webhooks save actions ON THE MAIN SITE to bind schedules to the main origin/CRON_SECRET. Confirm real successful background checks and new notifications. Disable old source schedules and old Vercel crons to prevent duplicate jobs. Auth and provider callbacks must point to the main address. Keep testing reachable until every friend has signed in and verified their own main-site history; only then redirect testing browser pages and disconnect testing’s Git integration. Keep both database backups. Main remains the existing main project and database.

## Boundaries

The tool transfers compatible owner-scoped PUBLIC application rows, including statistics, costs, inventory, financial records, saved private connections and webhook history. It does not transfer auth users/passwords, storage bucket files, server environment variables, provider developer applications, global cron/Vault configuration or unscoped legacy tables. These must be explicitly reviewed before announcing that everything is transferred. Connections copied between different developer apps may require reauthorization. No hosted migration occurs by deploying this PR.

## Checks

`node scripts/validate-consolidation.cjs` uses two isolated PGlite databases to test user mapping, original-record preservation, additive import, conflict rejection, encryption-key rotation, generated audit IDs, schema compatibility and repeat-run deduplication.

`node scripts/validate-whatnot-connections.cjs` verifies database credential isolation, seller binding and idempotent setup. Route tests cover per-user Whatnot token selection and owner-derived saves. The build and existing multiuser/Whatnot tests should pass before deployment. These tests do not contact live Supabase, Whatnot or Vercel.
