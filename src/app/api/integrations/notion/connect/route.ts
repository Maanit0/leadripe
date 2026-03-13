import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "@/stack/server";

export async function GET(req: NextRequest) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Notion OAuth is not configured" },
      { status: 500 }
    );
  }

  // Encode return path in state so callback knows where to redirect
  const returnTo = req.nextUrl.searchParams.get("return_to") || "/settings";
  const state = `${user.id}|${returnTo}`;

  const authUrl =
    `https://api.notion.com/v1/oauth/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&owner=user` +
    `&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(authUrl);
}
