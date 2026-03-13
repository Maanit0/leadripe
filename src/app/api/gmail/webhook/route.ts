import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/db-admin";
import { id } from "@instantdb/admin";
import { getGmailAccessToken } from "@/lib/gmail/token";
import { classifyReply } from "@/lib/ai/classify-reply";
import { updateDealFromClassification } from "@/lib/hubspot/sync";

/**
 * Google Pub/Sub push endpoint for Gmail notifications.
 *
 * When a user's inbox changes, Google sends a POST here with a Pub/Sub message
 * containing the user's email and a historyId. We then:
 * 1. Find the user by email
 * 2. Fetch new messages since last historyId
 * 3. For inbound messages, match to deals by threadId
 * 4. Classify intent and update deal accordingly
 */
export async function POST(req: NextRequest) {
  // Pub/Sub requires fast acknowledgement — return 200 immediately
  // and process asynchronously via waitUntil-style pattern
  try {
    const body = await req.json();

    // Decode Pub/Sub message
    const pubsubMessage = body.message;
    if (!pubsubMessage?.data) {
      return NextResponse.json({ error: "No message data" }, { status: 400 });
    }

    const decoded = JSON.parse(
      Buffer.from(pubsubMessage.data, "base64").toString("utf-8")
    );

    const emailAddress: string | undefined = decoded.emailAddress;
    const historyId: string | undefined = decoded.historyId;

    if (!emailAddress || !historyId) {
      return NextResponse.json({ error: "Missing emailAddress or historyId" }, { status: 400 });
    }

    // Process in background — respond to Pub/Sub immediately
    processGmailNotification(emailAddress, historyId).catch((error) => {
      console.error("Gmail webhook processing error:", error);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Gmail webhook error:", error);
    // Still return 200 to prevent Pub/Sub retries on parse errors
    return NextResponse.json({ ok: true });
  }
}

async function processGmailNotification(
  emailAddress: string,
  newHistoryId: string
): Promise<void> {
  // Find user by email in InstantDB
  const { $users } = await adminDb.query({
    $users: {
      $: { where: { email: emailAddress } },
      profile: {},
    },
  });

  const user = $users[0];
  if (!user) {
    console.warn(`Gmail webhook: no user found for ${emailAddress}`);
    return;
  }

  const profile = (user as unknown as { profile: { id: string; lastHistoryId?: string }[] })
    .profile?.[0];
  if (!profile) {
    console.warn(`Gmail webhook: no profile for user ${user.id}`);
    return;
  }

  const lastHistoryId = profile.lastHistoryId;
  if (!lastHistoryId) {
    // No baseline — just store current historyId and return
    await adminDb.transact(
      adminDb.tx.profiles[profile.id]!.update({ lastHistoryId: newHistoryId })
    );
    return;
  }

  // Get Gmail access token
  let accessToken: string;
  try {
    accessToken = await getGmailAccessToken(user.id);
  } catch {
    console.error(`Gmail webhook: token error for ${emailAddress}`);
    return;
  }

  // Fetch message history since last checkpoint
  const historyUrl =
    `https://www.googleapis.com/gmail/v1/users/me/history` +
    `?startHistoryId=${lastHistoryId}` +
    `&historyTypes=messageAdded` +
    `&labelId=INBOX`;

  const historyRes = await fetch(historyUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!historyRes.ok) {
    // 404 means historyId is too old — reset
    if (historyRes.status === 404) {
      await adminDb.transact(
        adminDb.tx.profiles[profile.id]!.update({ lastHistoryId: newHistoryId })
      );
    }
    return;
  }

  const historyData = await historyRes.json();
  const histories: Array<{
    messagesAdded?: Array<{ message: { id: string; threadId: string; labelIds?: string[] } }>;
  }> = historyData.history ?? [];

  // Collect unique new inbound message IDs
  const inboundMessages: Array<{ messageId: string; threadId: string }> = [];

  for (const entry of histories) {
    for (const added of entry.messagesAdded ?? []) {
      const msg = added.message;
      // Skip sent messages — we only want inbound
      if (msg.labelIds?.includes("SENT")) continue;
      inboundMessages.push({ messageId: msg.id, threadId: msg.threadId });
    }
  }

  // Process each inbound message
  for (const { messageId, threadId } of inboundMessages) {
    try {
      await processInboundMessage(user.id, accessToken, messageId, threadId);
    } catch (error) {
      console.error(`Failed to process message ${messageId}:`, error);
    }
  }

  // Update history checkpoint
  await adminDb.transact(
    adminDb.tx.profiles[profile.id]!.update({ lastHistoryId: newHistoryId })
  );
}

async function processInboundMessage(
  userId: string,
  accessToken: string,
  gmailMessageId: string,
  threadId: string
): Promise<void> {
  // Check if we already processed this message
  const { messages: existingMessages } = await adminDb.query({
    messages: {
      $: { where: { gmailMessageId } },
    },
  });

  if (existingMessages.length > 0) return; // Already processed

  // Find deal by matching threadId from a prior outbound message
  const { messages: threadMessages } = await adminDb.query({
    messages: {
      $: { where: { gmailThreadId: threadId } },
      deal: {},
    },
  });

  if (threadMessages.length === 0) return; // No matching deal — not a reply to our email

  const matchedMessage = threadMessages[0];
  const deal = (matchedMessage as unknown as { deal: Array<Record<string, unknown>> }).deal?.[0];
  if (!deal) return;

  const dealId = deal.id as string;

  // Fetch full message body from Gmail
  const msgRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!msgRes.ok) return;

  const msgData = await msgRes.json();
  const replyBody = extractPlainTextBody(msgData);

  if (!replyBody) return;

  // Get prior outbound messages in this thread for context
  const priorMessages = threadMessages
    .filter((m) => m.direction === "outbound")
    .map((m) => m.body);

  const lastOutbound = priorMessages[priorMessages.length - 1] ?? "";

  // Save inbound message to InstantDB
  const inboundMessageId = id();
  await adminDb.transact(
    adminDb.tx.messages[inboundMessageId]!
      .update({
        body: replyBody,
        direction: "inbound",
        gmailMessageId,
        gmailThreadId: threadId,
        sentAt: Date.now(),
        createdAt: Date.now(),
      })
      .link({ deal: dealId })
  );

  // Classify the reply
  const classification = await classifyReply({
    deal_stage: deal.stage as string,
    contact_name: deal.contactName as string,
    contact_role: (deal.contactRole as string) ?? "",
    company_name: deal.companyName as string,
    last_message_sent: lastOutbound,
    reply_text: replyBody,
    thread_history: priorMessages,
  });

  // Update the inbound message with its classification
  await adminDb.transact(
    adminDb.tx.messages[inboundMessageId]!.update({
      intentClassification: JSON.stringify(classification),
    })
  );

  // Update deal stage and write back to HubSpot
  await updateDealFromClassification(dealId, classification);
}

/**
 * Extracts plain text body from a Gmail API message response.
 * Handles both simple and multipart MIME structures.
 */
function extractPlainTextBody(
  msgData: Record<string, unknown>
): string | null {
  const payload = msgData.payload as Record<string, unknown> | undefined;
  if (!payload) return null;

  // Simple message with body directly on payload
  const body = payload.body as { data?: string } | undefined;
  if (body?.data) {
    return Buffer.from(body.data, "base64").toString("utf-8");
  }

  // Multipart — search for text/plain
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (!parts) return null;

  for (const part of parts) {
    const mimeType = part.mimeType as string;
    const partBody = part.body as { data?: string } | undefined;

    if (mimeType === "text/plain" && partBody?.data) {
      return Buffer.from(partBody.data, "base64").toString("utf-8");
    }

    // Nested multipart
    const nestedParts = part.parts as Array<Record<string, unknown>> | undefined;
    if (nestedParts) {
      for (const nested of nestedParts) {
        const nestedMime = nested.mimeType as string;
        const nestedBody = nested.body as { data?: string } | undefined;
        if (nestedMime === "text/plain" && nestedBody?.data) {
          return Buffer.from(nestedBody.data, "base64").toString("utf-8");
        }
      }
    }
  }

  return null;
}
