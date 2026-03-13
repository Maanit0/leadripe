import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "@/stack/server";
import { adminDb } from "@/lib/db-admin";

const PROVIDER_FIELDS: Record<string, Record<string, unknown>> = {
  hubspot: {
    hubspotAccessToken: "",
    hubspotLastSynced: 0,
  },
  notion: {
    notionAccessToken: "",
  },
};

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider } = await params;
  const fields = PROVIDER_FIELDS[provider];
  if (!fields) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const { profiles } = await adminDb.query({
    profiles: {
      $: { where: { "user.id": user.id } },
    },
  });

  if (profiles.length === 0) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  await adminDb.transact(
    adminDb.tx.profiles[profiles[0].id]!.update(fields)
  );

  return NextResponse.json({ ok: true });
}
