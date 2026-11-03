# Soul Analytics — private website starter

This is the **frontend + Supabase authentication starter**, not a finished financial integration.

## Upload to GitHub without installing Git
1. Open your **private** `soul-analytics` repository on GitHub.
2. Choose **Add file → Upload files** and upload the *contents* of this folder (preserve nested folders). GitHub browser uploads can be awkward for folders; uploading the entire extracted folder through the browser's drag-and-drop may preserve paths. If it doesn't, use GitHub Desktop or VS Code to push the folder.
3. In Vercel, import the repository, select **Next.js**, and deploy.

## Configure environment variables in Vercel
In **Project → Settings → Environment Variables**:
- `NEXT_PUBLIC_SUPABASE_URL` = Supabase Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase publishable key (or legacy anon key)

These two are intentionally public client-side keys. **Never put the Supabase service-role key or database password in a `NEXT_PUBLIC_` variable or GitHub.**

Redeploy after adding environment variables.

## Supabase Auth URL configuration
In **Authentication → URL Configuration**, set:
- Site URL = your actual `https://YOUR-DEPLOYMENT.vercel.app`
- Additional redirect URLs:
  - `https://YOUR-DEPLOYMENT.vercel.app/auth/callback`
  - `https://YOUR-DEPLOYMENT.vercel.app/auth/update-password`

**Supabase invitation email template:** In **Authentication → Email Templates → Invite user**, ensure the link redirects to the callback endpoint. One compatible template is:
`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite`
For recovery, use:
`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`

Then resend a fresh invite; old invite links may be expired.

## Access control
This UI checks the `profiles` table to determine whether to show the owner dashboard. This is **not** a replacement for secure RLS and server-side authorization. Before connecting real financial data, verify the `owner_allowlist` / `profiles` trigger and RLS policies with an unauthenticated user and an unauthorized user.

## Status
- Implemented: dark UI, exact Soul logo, sign-in, password recovery/setup routes, session handling, placeholder dashboard.
- Not implemented: Whatnot/TikTok sync, fee/refund calculations, Render backend, payouts, reconciliation, production security audit.
