import { NextResponse } from "next/server";
import { stackServerApp } from "@/stack/server";
import { adminDb } from "@/lib/db-admin";
import { setupGmailWatch } from "@/lib/gmail/watch";

/**
 * POST /api/gmail/watch
 * Registers Gmail push notifications for the current user.
 * Should be called once after sign-in, then renewed every 7 days.
 */
export async function POST() {
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { historyId, expiration } = await setupGmailWatch(user.id);

    // Store the initial historyId so the webhook knows where to start
    const { profiles } = await adminDb.query({
      profiles: {
        $: { where: { "user.id": user.id } },
      },
    });

    if (profiles.length > 0 && !profiles[0].lastHistoryId) {
      await adminDb.transact(
        adminDb.tx.profiles[profiles[0].id]!.update({ lastHistoryId: historyId })
      );
    }

    return NextResponse.json({ ok: true, historyId, expiration });
  } catch (error) {
    console.error("Gmail watch setup failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Watch setup failed" },
      { status: 500 }
    );
  }
}
