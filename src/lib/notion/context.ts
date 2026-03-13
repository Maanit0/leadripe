import { adminDb } from "@/lib/db-admin";

interface NotionBlock {
  type: string;
  paragraph?: { rich_text: Array<{ plain_text: string }> };
  heading_1?: { rich_text: Array<{ plain_text: string }> };
  heading_2?: { rich_text: Array<{ plain_text: string }> };
  heading_3?: { rich_text: Array<{ plain_text: string }> };
  bulleted_list_item?: { rich_text: Array<{ plain_text: string }> };
  numbered_list_item?: { rich_text: Array<{ plain_text: string }> };
  to_do?: { rich_text: Array<{ plain_text: string }> };
}

function extractBlockText(block: NotionBlock): string {
  const richText =
    block.paragraph?.rich_text ??
    block.heading_1?.rich_text ??
    block.heading_2?.rich_text ??
    block.heading_3?.rich_text ??
    block.bulleted_list_item?.rich_text ??
    block.numbered_list_item?.rich_text ??
    block.to_do?.rich_text;

  if (!richText) return "";

  const text = richText.map((t) => t.plain_text).join("");

  if (block.type.startsWith("heading")) return `\n${text}\n`;
  if (block.type === "bulleted_list_item" || block.type === "numbered_list_item") return `- ${text}`;

  return text;
}

/**
 * Searches Notion for context about a deal.
 * Tries companyName first, falls back to contactName.
 * Returns plain text summary (max 1000 chars) or null.
 */
export async function getNotionContext(
  userId: string,
  companyName: string,
  contactName: string
): Promise<string | null> {
  // Get user's Notion token
  const { profiles } = await adminDb.query({
    profiles: {
      $: { where: { "user.id": userId } },
    },
  });

  const token = profiles[0]?.notionAccessToken;
  if (!token) return null;

  // Search by company name first, then contact name
  const pageId = await searchNotion(token, companyName) ?? await searchNotion(token, contactName);
  if (!pageId) return null;

  // Fetch page blocks
  try {
    const blocksRes = await fetch(
      `https://api.notion.com/v1/blocks/${pageId}/children?page_size=50`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
        },
      }
    );

    if (!blocksRes.ok) return null;

    const blocksData = await blocksRes.json();
    const blocks: NotionBlock[] = blocksData.results ?? [];

    const lines = blocks
      .map(extractBlockText)
      .filter((line) => line.length > 0);

    const fullText = lines.join("\n").trim();

    // Cap at 1000 chars
    if (fullText.length > 1000) {
      return fullText.slice(0, 997) + "...";
    }

    return fullText || null;
  } catch {
    return null;
  }
}

async function searchNotion(
  token: string,
  query: string
): Promise<string | null> {
  if (!query || query === "Unknown") return null;

  try {
    const res = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        query,
        filter: { property: "object", value: "page" },
        page_size: 1,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const results = data.results ?? [];

    return results.length > 0 ? results[0].id : null;
  } catch {
    return null;
  }
}
