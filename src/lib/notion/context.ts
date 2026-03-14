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
  toggle?: { rich_text: Array<{ plain_text: string }> };
  callout?: { rich_text: Array<{ plain_text: string }> };
  quote?: { rich_text: Array<{ plain_text: string }> };
}

function extractBlockText(block: NotionBlock): string {
  const richText =
    block.paragraph?.rich_text ??
    block.heading_1?.rich_text ??
    block.heading_2?.rich_text ??
    block.heading_3?.rich_text ??
    block.bulleted_list_item?.rich_text ??
    block.numbered_list_item?.rich_text ??
    block.to_do?.rich_text ??
    block.toggle?.rich_text ??
    block.callout?.rich_text ??
    block.quote?.rich_text;

  if (!richText) return "";

  const text = richText.map((t) => t.plain_text).join("");

  if (block.type.startsWith("heading")) return `\n${text}\n`;
  if (block.type === "bulleted_list_item" || block.type === "numbered_list_item") return `- ${text}`;

  return text;
}

/**
 * Searches Notion for context about a deal.
 * First tries querying databases by Contact Name property,
 * then falls back to general search by contact/company name.
 * Returns plain text summary (max 4000 chars) or null.
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
  if (!token) {
    console.log("[notion] No token found for user");
    return null;
  }

  // Strategy 1: Find databases and query by Contact Name property
  let pageId = await queryDatabaseByContactName(token, contactName);

  // Strategy 2: Fall back to general search
  if (!pageId) {
    console.log(`[notion] Database query found nothing, trying search for "${contactName}"`);
    pageId = await searchNotion(token, contactName);
  }
  if (!pageId) {
    console.log(`[notion] Search for contact name found nothing, trying "${companyName}"`);
    pageId = await searchNotion(token, companyName);
  }

  if (!pageId) {
    console.log(`[notion] No page found for ${contactName} / ${companyName}`);
    return null;
  }

  console.log(`[notion] Found page ${pageId} for ${contactName}`);

  // Fetch page blocks (up to 100)
  try {
    const blocksRes = await fetch(
      `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
        },
      }
    );

    if (!blocksRes.ok) {
      console.error(`[notion] Failed to fetch blocks: ${blocksRes.status} ${await blocksRes.text()}`);
      return null;
    }

    const blocksData = await blocksRes.json();
    const blocks: NotionBlock[] = blocksData.results ?? [];

    const lines = blocks
      .map(extractBlockText)
      .filter((line) => line.length > 0);

    const fullText = lines.join("\n").trim();
    console.log(`[notion] Extracted ${fullText.length} chars from page`);

    // Cap at 4000 chars to give the AI enough context from transcripts
    if (fullText.length > 4000) {
      return fullText.slice(0, 3997) + "...";
    }

    return fullText || null;
  } catch (err) {
    console.error("[notion] Error fetching blocks:", err);
    return null;
  }
}

/**
 * Finds databases the integration has access to,
 * then queries them for pages where Contact Name matches.
 */
async function queryDatabaseByContactName(
  token: string,
  contactName: string
): Promise<string | null> {
  if (!contactName || contactName === "Unknown") return null;

  try {
    // First, find databases the integration can access
    const searchRes = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        filter: { property: "object", value: "database" },
        page_size: 10,
      }),
    });

    if (!searchRes.ok) {
      console.error(`[notion] Database search failed: ${searchRes.status} ${await searchRes.text()}`);
      return null;
    }

    const searchData = await searchRes.json();
    const databases = searchData.results ?? [];
    console.log(`[notion] Found ${databases.length} databases`);

    // Query each database for the contact name
    for (const db of databases) {
      const dbId = db.id;
      const properties = db.properties ?? {};

      // Check if this database has a "Contact Name" property
      const contactNameProp = Object.keys(properties).find(
        (key) => key.toLowerCase().replace(/\s/g, "") === "contactname"
      );

      if (!contactNameProp) {
        console.log(`[notion] Database ${dbId} has no Contact Name property, trying title search`);
        // Try querying by title instead
        const titleProp = Object.keys(properties).find(
          (key) => properties[key].type === "title"
        );
        if (titleProp) {
          const pageId = await queryDatabase(token, dbId, titleProp, contactName, "title");
          if (pageId) return pageId;
        }
        continue;
      }

      console.log(`[notion] Querying database ${dbId} for Contact Name = "${contactName}"`);
      const pageId = await queryDatabase(token, dbId, contactNameProp, contactName, properties[contactNameProp].type);
      if (pageId) return pageId;
    }

    return null;
  } catch (err) {
    console.error("[notion] Database query error:", err);
    return null;
  }
}

async function queryDatabase(
  token: string,
  databaseId: string,
  propertyName: string,
  value: string,
  propertyType: string
): Promise<string | null> {
  try {
    // Build filter based on property type
    let filter: Record<string, unknown>;
    if (propertyType === "title") {
      filter = {
        property: propertyName,
        title: { contains: value.split(" ")[0] }, // Search by first name
      };
    } else {
      // rich_text type
      filter = {
        property: propertyName,
        rich_text: { contains: value.split(" ")[0] },
      };
    }

    const res = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          filter,
          page_size: 5,
          sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
        }),
      }
    );

    if (!res.ok) {
      console.error(`[notion] Database query failed: ${res.status} ${await res.text()}`);
      return null;
    }

    const data = await res.json();
    const results = data.results ?? [];
    console.log(`[notion] Database query returned ${results.length} results for "${value}"`);

    if (results.length === 0) return null;

    // Return the most recently edited matching page
    return results[0].id;
  } catch (err) {
    console.error("[notion] Query error:", err);
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
        page_size: 3,
      }),
    });

    if (!res.ok) {
      console.error(`[notion] Search failed: ${res.status} ${await res.text()}`);
      return null;
    }

    const data = await res.json();
    const results = data.results ?? [];
    console.log(`[notion] Search for "${query}" returned ${results.length} results`);

    if (results.length === 0) return null;

    return results[0].id;
  } catch (err) {
    console.error("[notion] Search error:", err);
    return null;
  }
}
