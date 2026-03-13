import { getGmailAccessToken } from "./token";

/**
 * Sets up Gmail push notifications via Google Pub/Sub.
 * After calling this, Gmail will POST to our webhook whenever
 * new messages arrive in the user's inbox.
 *
 * Must be called after Gmail OAuth completes, and renewed every 7 days.
 */
export async function setupGmailWatch(userId: string): Promise<{
  historyId: string;
  expiration: string;
}> {
  const accessToken = await getGmailAccessToken(userId);
  const topicName = process.env.GOOGLE_PUBSUB_TOPIC;

  if (!topicName) {
    throw new Error(
      "GOOGLE_PUBSUB_TOPIC is not configured (e.g. projects/your-project/topics/gmail-notifications)"
    );
  }

  const res = await fetch(
    "https://www.googleapis.com/gmail/v1/users/me/watch",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topicName,
        labelIds: ["INBOX"],
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gmail watch setup failed: ${await res.text()}`);
  }

  const data = await res.json();
  return {
    historyId: data.historyId,
    expiration: data.expiration,
  };
}
