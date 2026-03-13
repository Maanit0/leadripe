import { stackServerApp } from "@/stack/server";
import { adminDb } from "@/lib/db-admin";

/**
 * Gets a valid Gmail access token for a user.
 *
 * Strategy:
 * 1. Try Stack Auth (works in API route context where user has a session).
 *    Stack Auth handles token refresh automatically.
 *    Also syncs the fresh token to InstantDB for webhook access.
 * 2. Fall back to stored token in InstantDB (for webhook/Pub/Sub context
 *    where there's no active user session).
 */
export async function getGmailAccessToken(userId: string): Promise<string> {
  // Try Stack Auth first (API route context)
  try {
    const user = await stackServerApp.getUser();
    if (user) {
      const account = await user.getConnectedAccount("google", {
        or: "return-null",
      });
      if (account) {
        const result = await account.getAccessToken();
        if (result?.accessToken) {
          const token = result.accessToken;

          // Sync to InstantDB so the webhook can use it
          syncTokenToInstantDB(userId, token).catch((err) => {
            console.error("Failed to sync Google token to InstantDB:", err);
          });

          return token;
        }
      }
    }
  } catch {
    // Not in request context — fall through to stored token
  }

  // Fall back to stored token (webhook context)
  const { profiles } = await adminDb.query({
    profiles: {
      $: { where: { "user.id": userId } },
    },
  });

  const token = profiles[0]?.gmailAccessToken;
  if (!token) {
    throw new Error("Gmail is not connected");
  }

  return token;
}

async function syncTokenToInstantDB(
  userId: string,
  accessToken: string
): Promise<void> {
  const { profiles } = await adminDb.query({
    profiles: {
      $: { where: { "user.id": userId } },
    },
  });

  if (profiles.length > 0) {
    await adminDb.transact(
      adminDb.tx.profiles[profiles[0].id]!.update({
        gmailAccessToken: accessToken,
      })
    );
  }
}
