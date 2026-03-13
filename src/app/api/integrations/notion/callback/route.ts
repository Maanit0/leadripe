import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/db-admin";
import { id } from "@instantdb/admin";
import { parseOAuthState } from "@/lib/integrations/state";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateRaw = req.nextUrl.searchParams.get("state");

  if (!code || !stateRaw) {
    return NextResponse.redirect(
      new URL("/settings?notion=error&reason=missing_params", req.url)
    );
  }

  const { userId, returnTo } = parseOAuthState(stateRaw);

  const clientId = process.env.NOTION_CLIENT_ID!;
  const clientSecret = process.env.NOTION_CLIENT_SECRET!;
  const redirectUri = process.env.NOTION_REDIRECT_URI!;

  try {
    // Notion uses Basic auth for token exchange
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );

    const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("Notion token exchange failed:", errorText);
      return NextResponse.redirect(
        new URL(`${returnTo}?notion=error&reason=token_exchange`, req.url)
      );
    }

    const tokens = await tokenRes.json();

    // Find existing profile for this user
    const { profiles } = await adminDb.query({
      profiles: {
        $: { where: { "user.id": userId } },
      },
    });

    if (profiles.length > 0) {
      await adminDb.transact(
        adminDb.tx.profiles[profiles[0].id]!.update({
          notionAccessToken: tokens.access_token,
        })
      );
    } else {
      const profileId = id();
      await adminDb.transact(
        adminDb.tx.profiles[profileId]!
          .update({
            notionAccessToken: tokens.access_token,
            createdAt: Date.now(),
          })
          .link({ user: userId })
      );
    }

    return NextResponse.redirect(
      new URL(`${returnTo}?notion=connected`, req.url)
    );
  } catch (error) {
    console.error("Notion OAuth callback error:", error);
    return NextResponse.redirect(
      new URL(`${returnTo}?notion=error&reason=server_error`, req.url)
    );
  }
}
