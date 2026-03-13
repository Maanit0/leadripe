import { getAnthropicClient } from "./client";
import { INTENT_CLASSIFIER_PROMPT } from "./prompts";
import type { ClassifyReplyInput, ClassifyReplyOutput } from "./types";

export async function classifyReply(
  input: ClassifyReplyInput
): Promise<ClassifyReplyOutput> {
  const client = getAnthropicClient();

  const userMessage = JSON.stringify({
    deal_stage: input.deal_stage,
    contact_name: input.contact_name,
    contact_role: input.contact_role,
    company_name: input.company_name,
    last_message_sent: input.last_message_sent,
    reply_text: input.reply_text,
    thread_history: input.thread_history ?? [],
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: INTENT_CLASSIFIER_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "");

  return JSON.parse(cleaned) as ClassifyReplyOutput;
}
