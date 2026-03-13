import { NextRequest, NextResponse } from "next/server";
import { stackServerApp } from "@/stack/server";
import { sendEmail } from "@/lib/gmail/send";

export async function POST(req: NextRequest) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { dealId, to, subject, emailBody, tone, threadId, inReplyToMessageId } = body;

  if (!dealId || !to || !emailBody) {
    return NextResponse.json(
      { error: "Missing required fields: dealId, to, emailBody" },
      { status: 400 }
    );
  }

  try {
    const result = await sendEmail({
      userId: user.id,
      dealId,
      to,
      subject: subject ?? "Following up",
      body: emailBody,
      tone,
      threadId,
      inReplyToMessageId,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Gmail send failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Send failed" },
      { status: 500 }
    );
  }
}
