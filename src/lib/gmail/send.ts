import { getGmailAccessToken } from "./token";
import { adminDb } from "@/lib/db-admin";
import { id } from "@instantdb/admin";

/**
 * Builds an RFC 2822 email message and base64url-encodes it for the Gmail API.
 */
function buildRawEmail(
  from: string,
  to: string,
  subject: string,
  body: string,
  threadMessageId?: string
): string {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
  ];

  // If replying in a thread, add In-Reply-To and References headers
  if (threadMessageId) {
    headers.push(`In-Reply-To: ${threadMessageId}`);
    headers.push(`References: ${threadMessageId}`);
  }

  const raw = headers.join("\r\n") + "\r\n\r\n" + body;

  // Base64url encode (Gmail API requires URL-safe base64)
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

interface SendEmailOptions {
  userId: string;
  dealId: string;
  to: string;
  subject: string;
  body: string;
  tone?: string;
  /** Gmail thread ID to reply within (optional) */
  threadId?: string;
  /** RFC 2822 Message-ID to reply to (optional) */
  inReplyToMessageId?: string;
}

interface SendEmailResult {
  gmailMessageId: string;
  gmailThreadId: string;
  messageId: string; // Our InstantDB message ID
}

/**
 * Sends an email via Gmail API and saves the outbound message to InstantDB.
 */
export async function sendEmail(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const {
    userId,
    dealId,
    to,
    subject,
    body,
    tone,
    threadId,
    inReplyToMessageId,
  } = options;

  const accessToken = await getGmailAccessToken(userId);

  // Get sender email from Gmail profile
  const profileRes = await fetch(
    "https://www.googleapis.com/gmail/v1/users/me/profile",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!profileRes.ok) {
    throw new Error(`Failed to get Gmail profile: ${await profileRes.text()}`);
  }
  const gmailProfile = await profileRes.json();
  const fromEmail: string = gmailProfile.emailAddress;

  // Build the raw email
  const raw = buildRawEmail(fromEmail, to, subject, body, inReplyToMessageId);

  // Send via Gmail API
  const sendPayload: Record<string, string> = { raw };
  if (threadId) {
    sendPayload.threadId = threadId;
  }

  const sendRes = await fetch(
    "https://www.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendPayload),
    }
  );

  if (!sendRes.ok) {
    throw new Error(`Gmail send failed: ${await sendRes.text()}`);
  }

  const sendResult = await sendRes.json();
  const gmailMessageId: string = sendResult.id;
  const gmailThreadId: string = sendResult.threadId;

  // Save outbound message to InstantDB
  const messageId = id();
  await adminDb.transact(
    adminDb.tx.messages[messageId]!
      .update({
        body,
        tone: tone ?? "",
        sentAt: Date.now(),
        direction: "outbound",
        gmailMessageId,
        gmailThreadId,
        createdAt: Date.now(),
      })
      .link({ deal: dealId })
  );

  // Update deal's last touch
  await adminDb.transact(
    adminDb.tx.deals[dealId]!.update({
      lastTouchSummary: `Sent follow-up email on ${new Date().toLocaleDateString()}`,
      daysSinceLastTouch: 0,
      updatedAt: Date.now(),
    })
  );

  return { gmailMessageId, gmailThreadId, messageId };
}
