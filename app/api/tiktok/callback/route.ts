import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, encrypt } from "../../../../lib/tiktok";

export const runtime = "nodejs";

/**
 * Seller authorization sometimes returns a code without the optional state parameter.
 * A signed, short-lived, HttpOnly, SameSite=Lax cookie created by /start is mandatory.
 * If TikTok DOES return state, it must match exactly. Never accept a callback
 * without a valid signed cookie, even if the code is valid.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const done = (status: string) => {
    const response = NextResponse.redirect(new URL(`/?tiktok=${encodeURIComponent(status)}`, origin));
    response.cookies.set("soul_tiktok_auth", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/api/tiktok", maxAge: 0 });
    return response;
  };

  try {
    const secret = process.env.TIKTOK_SHOP_APP_SECRET;
    const key = process.env.TIKTOK_SHOP_APP_KEY;
    const raw = req.cookies.get("soul_tiktok_auth")?.value || "";
    const [savedState, userId, signature, extra] = raw.split(":");
    const returnedState = req.nextUrl.searchParams.get("state");
    const returnedAppKey = req.nextUrl.searchParams.get("app_key");
    const code = req.nextUrl.searchParams.get("code");

    if (!secret || !key || !savedState || !userId || !signature || extra || !code) {
      return done("authorization-session-missing");
    }
    if (returnedAppKey && returnedAppKey !== key) return done("authorization-app-mismatch");
    if (returnedState !== null && returnedState !== savedState) return done("authorization-state-mismatch");
    if (!/^[a-f0-9]{48}$/.test(savedState) || !/^[a-f0-9-]{36}$/.test(userId)) {
      return done("authorization-session-invalid");
    }

    const expected = createHmac("sha256", secret).update(`${savedState}:${userId}`).digest("hex");
    if (signature.length !== expected.length ||
        !timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"))) {
      return done("authorization-session-invalid");
    }

    const tokenUrl = new URL("https://auth.tiktok-shops.com/api/v2/token/get");
    tokenUrl.searchParams.set("app_key", key);
    tokenUrl.searchParams.set("app_secret", secret);
    tokenUrl.searchParams.set("auth_code", code);
    tokenUrl.searchParams.set("grant_type", "authorized_code");
    const result = await fetch(tokenUrl, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    const json = await result.json();
    if (!result.ok || json.code !== 0 || !json.data?.access_token || !json.data?.refresh_token) {
      return done("token-exchange-failed");
    }

    const data = json.data;
    const openId = String(data.open_id || data.seller_name || "unknown");
    const client = db();

    // Prevent a reauthorization from silently substituting another seller identity.
    const { data: existing, error: readError } = await client
      .from("tiktok_connections")
      .select("open_id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (readError) return done("storage-failed");
    if (existing?.open_id && existing.open_id !== "unknown" && openId !== "unknown" && existing.open_id !== openId) {
      return done("seller-account-mismatch");
    }

    const asExpiry = (value: unknown) => {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
    };
    const record = {
      owner_id: userId,
      open_id: openId,
      access_token_encrypted: encrypt(String(data.access_token)),
      refresh_token_encrypted: encrypt(String(data.refresh_token)),
      access_expires_at: asExpiry(data.access_token_expire_in),
      refresh_expires_at: asExpiry(data.refresh_token_expire_in),
      updated_at: new Date().toISOString(),
    };
    const { error } = await client.from("tiktok_connections").upsert(record, { onConflict: "owner_id" });
    if (error) return done("storage-failed");
    return done("connected");
  } catch {
    return done("connection-failed");
  }
}
