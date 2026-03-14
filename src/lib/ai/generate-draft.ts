import { getAnthropicClient } from "./client";
import { DRAFT_WRITER_PROMPT } from "./prompts";
import type { GenerateDraftInput, GenerateDraftOutput } from "./types";
import { getAvailableSlots } from "@/lib/calendar/slots";
import { getNotionContext } from "@/lib/notion/context";
import { getEmailHistory } from "@/lib/gmail/history";

const SLOT_STAGES = new Set(["replied_interested", "gone_silent", "follow_up"]);

export async function generateDraft(
  input: GenerateDraftInput & { userId?: string }
): Promise<GenerateDraftOutput> {
  const client = getAnthropicClient();

  // Fetch Notion context live if not already provided
  let notionContext = input.notion_context ?? "";
  if (!notionContext && input.userId && input.company_name) {
    try {
      notionContext = await getNotionContext(input.userId, input.company_name, input.contact_name) ?? "";
      console.log(`[draft] Notion context for ${input.contact_name} (${input.company_name}): ${notionContext ? `${notionContext.length} chars` : "NOT FOUND"}`);
    } catch (err) {
      console.error(`[draft] Notion fetch error for ${input.contact_name}:`, err);
    }
  }

  // Fetch real calendar slots for stages that need them
  let slots = input.available_slots ?? [];
  let calendlyLink = input.calendly_link ?? "";

  if (!SLOT_STAGES.has(input.deal_stage)) {
    slots = [];
    calendlyLink = "";
  } else if (slots.length === 0 && input.userId) {
    try {
      slots = await getAvailableSlots(input.userId);
    } catch {
      // Non-fatal — draft can still be generated without slots
    }
  }

  // Fetch Gmail conversation history if contact email is available
  let previousMessages = input.previous_messages_sent ?? [];
  if (previousMessages.length === 0 && input.userId && input.contact_email) {
    try {
      previousMessages = await getEmailHistory(input.userId, input.contact_email);
      console.log(`[draft] Gmail history for ${input.contact_name} (${input.contact_email}): ${previousMessages.length} messages`);
    } catch (err) {
      console.error(`[draft] Gmail fetch error for ${input.contact_name}:`, err);
    }
  }

  const userMessage = JSON.stringify({
    deal_stage: input.deal_stage,
    contact_name: input.contact_name,
    contact_role: input.contact_role,
    company_name: input.company_name,
    last_touch_summary: input.last_touch_summary,
    days_since_last_touch: input.days_since_last_touch,
    notion_context: notionContext,
    available_slots: slots,
    calendly_link: calendlyLink,
    previous_messages_sent: previousMessages,
    sender_name: input.sender_name,
    tone: input.tone,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: DRAFT_WRITER_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const body =
    response.content[0].type === "text" ? response.content[0].text.trim() : "";

  return { body };
}
