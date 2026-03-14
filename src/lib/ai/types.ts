// ── Intent Classification Types ──

export const INTENT_TYPES = [
  "POSITIVE_ADVANCE",
  "CALENDAR_ACCEPTED",
  "CALENDAR_DECLINED",
  "POSITIVE_HOLD",
  "OBJECTION",
  "NEGATIVE",
  "NOT_NOW",
  "UNCLEAR",
  "OUT_OF_OFFICE",
] as const;

export type IntentType = (typeof INTENT_TYPES)[number];

export type Confidence = "high" | "medium" | "low";

export interface ClassifyReplyInput {
  deal_stage: string;
  contact_name: string;
  contact_role: string;
  company_name: string;
  last_message_sent: string;
  reply_text: string;
  thread_history?: string[];
}

export interface ClassifyReplyOutput {
  intent: IntentType;
  confidence: Confidence;
  suggested_stage:
    | "replied_interested"
    | "demo_booked"
    | "closed_lost"
    | "nurture"
    | "no_change";
  send_calendar_invite: boolean;
  suggested_slot: string | null;
  objection_summary: string | null;
  question_asked: string | null;
  follow_up_date: string | null;
  flag_for_human: boolean;
  flag_reason: string | null;
  one_line_summary: string;
}

// ── Draft Generation Types ──

export type Tone = "warm" | "short" | "bold";

export interface GenerateDraftInput {
  deal_stage: string;
  contact_name: string;
  contact_role: string;
  company_name: string;
  contact_email?: string;
  last_touch_summary: string;
  days_since_last_touch: number;
  notion_context?: string;
  available_slots?: string[];
  calendly_link?: string;
  previous_messages_sent?: string[];
  sender_name: string;
  tone: Tone;
}

export interface GenerateDraftOutput {
  body: string;
}
