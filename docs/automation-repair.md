# Start and verify automatic updates

The original setup separated payout preferences from scheduler activation, and defaulted all order-import platform toggles to off. Saving a webhook or clicking Check now did not start recurring jobs. A configured cron job also provided no proof its HTTP calls reached Vercel. Manual imports/checks could therefore work while nothing happened in the background.

## One-time repair

1. Merge/deploy this update. Run the complete `supabase/automation_repair.sql` file in Supabase SQL Editor. It is idempotent and includes the original order/payout setup; saved webhooks, history, orders and preferences are retained.
2. Open Integrations → **Automatic updates** and click **Start / repair automatic updates**. This enables imports for connected accounts and TikTok/Walmart alerts using the saved webhook, configures both recurring jobs, and queues their first requests through the real background HTTP path.
3. Wait for **Last background response** to populate. The status distinguishes a configured schedule from a verified HTTP response. Per-platform last successful import/error remains visible. Existing payout delivery history and duplicate protections remain intact. First-ever provider checks still baseline existing payouts silently.

Saving enabled payout preferences now configures and starts the schedule automatically. Saving enabled order preferences does the same for orders. Disabling either remains possible without working scheduler configuration. Manual Sync/Check now remain recovery tools, not requirements for recurring operation.

## Credentials and destination

The server uses the existing `CRON_SECRET` (at least 16 characters), and `PAYOUT_APP_URL` or Vercel's production hostname. URLs and cron credentials are written to Vault, not returned to the browser. `PAYOUT_APP_URL` must be the final production HTTPS origin without a path or query string.

If Vercel Deployment Protection blocks requests, configure Vercel's `VERCEL_AUTOMATION_BYPASS_SECRET` and redeploy, then repair. Its value is stored in Vault and sent only as the protection-bypass header. No browser cookie/login is used by the scheduler. This repair does not disable Vercel protection or change platform permissions.

## Status meanings

- Off: owner preferences are disabled, regardless of whether a shared cron job exists.
- Awaiting first run / Verifying: scheduled or queued, but no background response yet.
- HTTP 401: saved cron authorization does not match the deployment; repair after setting the current secret.
- HTTP 403: deployment access is blocked; inspect Vercel protection/bypass settings.
- Redirect / 404 / HTML response: wrong destination or old/missing deployment; correct the production origin and repair.
- Timeout / network failure / no response: inspect pg_net's queue/worker and Vercel reachability.
- Platform check failed: HTTP reached the site, but the returned cron result contains an import/payout error; inspect the corresponding platform status.
- Background endpoint verified: a tracked background HTTP request returned the expected result shape without a reported error. This does not guarantee every provider exposes current data or that every payment resulted in a Discord message.
- Background checks stopped: no recent background response was recorded. Manual checks do not update this evidence.

The private `automation_requests` table tracks pg_net request IDs, not credential headers or response bodies. Health RPC output exposes only summarized states/timestamps/status codes. Historical request IDs are pruned after two days; pg_net manages its own response retention. Both schedule names remain stable, so repairing updates the same jobs rather than duplicating them.

Orders retain five-minute polling and their existing recent-order coverage. Payouts retain one-minute polling, provider-status semantics, retry/uncertain-delivery handling, and owner-level duplicate protection. Live provider data and timing must still be verified in the deployed account. This setup requires no Railway worker and continues with the browser/laptop closed.

References: [Supabase pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [Vercel automation protection bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).
