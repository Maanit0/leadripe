import { getAnthropicClient } from "./client";
import { DRAFT_WRITER_PROMPT } from "./prompts";
import type { GenerateDraftInput, GenerateDraftOutput } from "./types";
import { getAvailableSlots } from "@/lib/calendar/slots";

const SLOT_STAGES = new Set(["replied_interested", "gone_silent"]);

export async function generateDraft(
  input: GenerateDraftInput & { userId?: string }
): Promise<GenerateDraftOutput> {
  const client = getAnthropicClient();

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

  const userMessage = JSON.stringify({
    deal_stage: input.deal_stage,
    contact_name: input.contact_name,
    contact_role: input.contact_role,
    company_name: input.company_name,
    last_touch_summary: input.last_touch_summary,
    days_since_last_touch: input.days_since_last_touch,
    notion_context: input.notion_context ?? "",
    available_slots: slots,
    calendly_link: calendlyLink,
    previous_messages_sent: input.previous_messages_sent ?? [],
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
