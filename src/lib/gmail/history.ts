import { getGmailAccessToken } from "./token";

interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  direction: "inbound" | "outbound";
}

/**
 * Searches Gmail for recent email conversation with a contact.
 * Returns messages sorted oldest-first, formatted for AI context.
 */
export async function getEmailHistory(
  userId: string,
  contactEmail: string
): Promise<string[]> {
  if (!contactEmail) return [];

  let accessToken: string;
  try {
    accessToken = await getGmailAccessToken(userId);
  } catch {
    return [];
  }

  // Get the user's own email
  const profileRes = await fetch(
    "https://www.googleapis.com/gmail/v1/users/me/profile",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!profileRes.ok) return [];
  const profile = await profileRes.json();
  const userEmail: string = profile.emailAddress.toLowerCase();

  // Search for messages with this contact (last 20)
  const query = encodeURIComponent(`from:${contactEmail} OR to:${contactEmail}`);
  const searchRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!searchRes.ok) return [];

  const searchData = await searchRes.json();
  const messageIds: Array<{ id: string }> = searchData.messages ?? [];

  if (messageIds.length === 0) return [];

  // Fetch each message (limit to 10 most recent to avoid rate limits)
  const messages: EmailMessage[] = [];
  const toFetch = messageIds.slice(0, 10);

  for (const { id } of toFetch) {
    try {
      const msgRes = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgRes.ok) continue;

      const msgData = await msgRes.json();
      const headers = msgData.payload?.headers ?? [];

      const from = getHeader(headers, "From") ?? "";
      const to = getHeader(headers, "To") ?? "";
      const subject = getHeader(headers, "Subject") ?? "";
      const date = getHeader(headers, "Date") ?? "";

      const body = extractPlainText(msgData.payload);
      if (!body) continue;

      const fromLower = from.toLowerCase();
      const direction: "inbound" | "outbound" = fromLower.includes(userEmail)
        ? "outbound"
        : "inbound";

      messages.push({ from, to, subject, body, date, direction });
    } catch {
      continue;
    }
  }

  // Sort oldest first
  messages.reverse();

  // Format for AI context
  return messages.map((m) => {
    const label = m.direction === "outbound" ? "You sent" : `${extractName(m.from)} replied`;
    // Truncate long emails to keep context manageable
    const truncatedBody = m.body.length > 500 ? m.body.slice(0, 497) + "..." : m.body;
    return `[${label} - ${m.date}]\n${truncatedBody}`;
  });
}

function getHeader(
  headers: Array<{ name: string; value: string }>,
  name: string
): string | undefined {
  return headers.find(
    (h: { name: string }) => h.name.toLowerCase() === name.toLowerCase()
  )?.value;
}

function extractName(from: string): string {
  // "Paul Smith <paul@example.com>" → "Paul Smith"
  const match = from.match(/^([^<]+)</);
  return match ? match[1].trim() : from.split("@")[0];
}

function extractPlainText(payload: Record<string, unknown>): string | null {
  if (!payload) return null;

  const body = payload.body as { data?: string } | undefined;
  if (body?.data) {
    return cleanEmailBody(
      Buffer.from(body.data, "base64").toString("utf-8")
    );
  }

  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (!parts) return null;

  for (const part of parts) {
    const mimeType = part.mimeType as string;
    const partBody = part.body as { data?: string } | undefined;

    if (mimeType === "text/plain" && partBody?.data) {
      return cleanEmailBody(
        Buffer.from(partBody.data, "base64").toString("utf-8")
      );
    }

    // Nested multipart
    const nestedParts = part.parts as Array<Record<string, unknown>> | undefined;
    if (nestedParts) {
      for (const nested of nestedParts) {
        const nestedMime = nested.mimeType as string;
        const nestedBody = nested.body as { data?: string } | undefined;
        if (nestedMime === "text/plain" && nestedBody?.data) {
          return cleanEmailBody(
            Buffer.from(nestedBody.data, "base64").toString("utf-8")
          );
        }
      }
    }
  }

  return null;
}

/**
 * Strips quoted reply chains and signatures to keep just the new content.
 */
function cleanEmailBody(text: string): string {
  // Remove quoted replies (lines starting with >)
  const lines = text.split("\n");
  const cleaned: string[] = [];
  for (const line of lines) {
    // Stop at common reply markers
    if (line.startsWith("On ") && line.includes(" wrote:")) break;
    if (line.startsWith(">")) continue;
    if (line.trim() === "--") break; // Signature separator
    cleaned.push(line);
  }
  return cleaned.join("\n").trim();
}
