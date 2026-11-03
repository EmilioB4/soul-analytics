# Soul Analytics TikTok Shop integration status

This version adds a visible TikTok Shop integration section to the existing authenticated dashboard. The Connect button is intentionally disabled because a functioning OAuth authorization callback, token storage, scopes validation, and TikTok API synchronization are **not** implemented yet. No shop data is fetched.

The existing Supabase login remains unchanged. Vercel server-side environment variables TIKTOK_SHOP_APP_KEY and TIKTOK_SHOP_APP_SECRET should remain secret. Do not expose these in client components or NEXT_PUBLIC variables.

Next development steps: implement server-side authorization initiation and callback, verify TikTok Shop developer docs and app publishing requirements, store access tokens securely, and synchronize orders and settlements.
