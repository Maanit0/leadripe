import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "@/stack/server";
import { classifyReply } from "@/lib/ai/classify-reply";
import type { ClassifyReplyInput } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  // Require authentication
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as ClassifyReplyInput;

  // Validate required fields
  if (!body.reply_text || !body.contact_name || !body.deal_stage) {
    return NextResponse.json(
      { error: "Missing required fields: reply_text, contact_name, deal_stage" },
      { status: 400 }
    );
  }

  try {
    const result = await classifyReply(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Intent classification failed:", error);
    return NextResponse.json(
      { error: "Classification failed" },
      { status: 500 }
    );
  }
}
