import { NextResponse } from "next/server";
import { stackServerApp } from "@/stack/server";
import { syncHubspotDeals } from "@/lib/hubspot/sync";

export async function POST() {
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncHubspotDeals(user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("HubSpot sync failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
