import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "@/stack/server";
import { generateDraft } from "@/lib/ai/generate-draft";
import type { GenerateDraftInput } from "@/lib/ai/types";

export async function POST(req: NextRequest) {
  // Require authentication
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as GenerateDraftInput;

  // Validate required fields
  if (
    !body.contact_name ||
    !body.deal_stage ||
    !body.sender_name ||
    !body.tone
  ) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: contact_name, deal_stage, sender_name, tone",
      },
      { status: 400 }
    );
  }

  try {
    const result = await generateDraft({ ...body, userId: user.id });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Draft generation failed:", error);
    return NextResponse.json(
      { error: "Draft generation failed" },
      { status: 500 }
    );
  }
}
