import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "@/stack/server";
import { adminDb } from "@/lib/db-admin";
import { id } from "@instantdb/admin";

/**
 * POST - Save a HubSpot personal access token for the current user.
 * DELETE - Clear the stored token.
 */
export async function POST(req: NextRequest) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = (await req.json()) as { token?: string };
  if (!token?.trim()) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  // Validate the token with a lightweight API call
  const testRes = await fetch(
    "https://api.hubapi.com/crm/v3/objects/deals?limit=1",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!testRes.ok) {
    return NextResponse.json(
      { error: "Invalid token. Make sure it has CRM deals and contacts scopes." },
      { status: 400 }
    );
  }

  const { profiles } = await adminDb.query({
    profiles: { $: { where: { "user.id": user.id } } },
  });

  if (profiles.length > 0) {
    await adminDb.transact(
      adminDb.tx.profiles[profiles[0].id]!.update({
        hubspotAccessToken: token,
      })
    );
  } else {
    const profileId = id();
    await adminDb.transact(
      adminDb.tx.profiles[profileId]!
        .update({
          hubspotAccessToken: token,
          createdAt: Date.now(),
        })
        .link({ user: user.id })
    );
  }

  return NextResponse.json({ ok: true });
}
