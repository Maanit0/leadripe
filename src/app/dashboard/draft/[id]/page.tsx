"use client";

import { Suspense, useState, useEffect, use, useCallback } from "react";
import { useUser } from "@stackframe/stack";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";

type Tone = "warm" | "short" | "bold";

const TONE_LABELS: Record<Tone, string> = {
  warm: "Warm",
  short: "Shorter",
  bold: "Bolder",
};

const STAGE_CONFIG: Record<
  string,
  { color: string; bg: string; dot: string; label: string }
> = {
  replied_interested: {
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
    dot: "bg-green-500",
    label: "Replied / interested",
  },
  demo_booked: {
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    dot: "bg-blue-500",
    label: "Demo booked",
  },
  demo_done: {
    color: "text-indigo-700",
    bg: "bg-indigo-50 border-indigo-200",
    dot: "bg-indigo-500",
    label: "Demo done",
  },
  proposal_sent: {
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    dot: "bg-amber-500",
    label: "Proposal sent",
  },
  gone_silent: {
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    dot: "bg-red-500",
    label: "Gone silent",
  },
  stalled: {
    color: "text-gray-700",
    bg: "bg-gray-50 border-gray-200",
    dot: "bg-gray-500",
    label: "Stalled",
  },
  nurture: {
    color: "text-purple-700",
    bg: "bg-purple-50 border-purple-200",
    dot: "bg-purple-500",
    label: "Nurture",
  },
};

const DEFAULT_STAGE = {
  color: "text-gray-700",
  bg: "bg-gray-50 border-gray-200",
  dot: "bg-gray-500",
  label: "Unknown",
};

const ACTIVE_STAGES = [
  "gone_silent",
  "stalled",
  "proposal_sent",
  "demo_done",
  "demo_booked",
  "replied_interested",
];

function DraftContent({ id }: { id: string }) {
  const user = useUser();
  const router = useRouter();
  const [tone, setTone] = useState<Tone>("warm");
  const [editedText, setEditedText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Query the deal, messages, and profile from InstantDB
  const { data, isLoading } = db.useQuery(
    user
      ? {
          deals: {
            $: { where: { "user.id": user.id } },
            messages: {},
          },
          profiles: {
            $: { where: { "user.id": user.id } },
          },
        }
      : null
  );

  const deals = data?.deals ?? [];
  const deal = deals.find((d) => d.id === id);
  const profile = data?.profiles?.[0];

  // Get previous messages for this deal, sorted by time
  const dealMessages = (deal as unknown as { messages?: Array<{ body: string; direction: string; createdAt: number }> })?.messages ?? [];
  const previousMessages = [...dealMessages]
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
    .map((m) => `[${m.direction}] ${m.body}`);

  // Sort active deals by urgency to find "next deal"
  const activeDealsSorted = [...deals]
    .filter((d) => ACTIVE_STAGES.includes(d.stage))
    .sort((a, b) => {
      const stageOrder: Record<string, number> = Object.fromEntries(
        ACTIVE_STAGES.map((s, i) => [s, i])
      );
      const stageDiff =
        (stageOrder[a.stage] ?? 99) - (stageOrder[b.stage] ?? 99);
      if (stageDiff !== 0) return stageDiff;
      return (b.daysSinceLastTouch ?? 0) - (a.daysSinceLastTouch ?? 0);
    });

  const currentIndex = activeDealsSorted.findIndex((d) => d.id === id);
  const nextDeal = activeDealsSorted[currentIndex + 1] ?? null;

  // Generate draft via AI
  const generateDraft = useCallback(
    async (selectedTone: Tone) => {
      if (!deal || !user) return;
      setGenerating(true);
      try {
        const res = await fetch("/api/ai/generate-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deal_stage: deal.stage,
            contact_name: deal.contactName,
            contact_role: deal.contactRole ?? "",
            company_name: deal.companyName,
            contact_email: deal.contactEmail ?? "",
            last_touch_summary: deal.lastTouchSummary ?? "",
            days_since_last_touch: deal.daysSinceLastTouch ?? 0,
            notion_context: deal.notionContext ?? "",
            previous_messages_sent: previousMessages,
            calendly_link: (profile?.calendlyLink as string) ?? "",
            sender_name: user.displayName?.split(" ")[0] ?? "Me",
            tone: selectedTone,
          }),
        });
        if (res.ok) {
          const { body } = await res.json();
          setEditedText(body);
        } else {
          console.error("Draft generation failed:", await res.text());
        }
      } catch (error) {
        console.error("Draft generation error:", error);
      } finally {
        setGenerating(false);
      }
    },
    [deal, user, profile]
  );

  // Generate initial draft when deal loads
  useEffect(() => {
    if (deal && user && !editedText && !generating) {
      generateDraft("warm");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id, user?.id]);

  const handleToneChange = (newTone: Tone) => {
    setTone(newTone);
    generateDraft(newTone);
  };

  const handleSend = async () => {
    if (!deal || !user || !editedText.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: deal.id,
          to: deal.contactEmail,
          subject: `Following up - ${deal.companyName}`,
          emailBody: editedText,
        }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        console.error("Send failed:", await res.text());
      }
    } catch (error) {
      console.error("Send error:", error);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!user) {
      router.replace("/");
    }
  }, [user, router]);

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-sm text-gray-500">Deal not found</p>
        <Link
          href="/dashboard"
          className="text-sm text-gray-900 underline"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  const stageConfig = STAGE_CONFIG[deal.stage] ?? DEFAULT_STAGE;

  if (sent) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm leading-none">
                L
              </span>
            </div>
            <span className="font-semibold text-gray-950 text-sm">
              LeadRipe
            </span>
          </div>
          <Link
            href="/dashboard"
            className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            Back to dashboard
          </Link>
        </header>

        <main className="max-w-xl mx-auto px-6 py-16">
          <div className="flex flex-col items-center gap-4 text-center mb-12">
            <div className="w-12 h-12 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-950">
                Sent to {deal.contactName}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">via Gmail</p>
            </div>
          </div>

          {nextDeal && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">Next up</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <div className="border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-2 min-w-0">
                    <div>
                      <p className="text-sm font-semibold text-gray-950">
                        {nextDeal.contactName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {nextDeal.contactRole
                          ? `${nextDeal.contactRole} · `
                          : ""}
                        {nextDeal.companyName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const sc =
                          STAGE_CONFIG[nextDeal.stage] ?? DEFAULT_STAGE;
                        return (
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${sc.bg} ${sc.color}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}
                            />
                            {sc.label}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-gray-500">
                      {nextDeal.daysSinceLastTouch} day
                      {nextDeal.daysSinceLastTouch === 1 ? "" : "s"} since last
                      touch
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/draft/${nextDeal.id}`}
                    className="flex-shrink-0 inline-flex items-center gap-1 bg-black text-white text-xs font-medium px-3.5 py-2 rounded-lg hover:bg-gray-900 transition-colors"
                  >
                    Review draft
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </>
          )}

          {!nextDeal && (
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-4">
                You&apos;ve cleared all your follow-ups.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center bg-black text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-900 transition-colors"
              >
                Back to dashboard
              </Link>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm leading-none">
              L
            </span>
          </div>
          <span className="font-semibold text-gray-950 text-sm">LeadRipe</span>
        </div>
        <div className="w-20" />
      </header>

      <main className="max-w-xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Deal context card */}
        <div className="border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-gray-950">
                {deal.contactName}
              </p>
              <p className="text-sm text-gray-500">
                {deal.contactRole ? `${deal.contactRole} · ` : ""}
                {deal.companyName}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${stageConfig.bg} ${stageConfig.color}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${stageConfig.dot}`}
              />
              {stageConfig.label}
            </span>
          </div>

          <div className="flex flex-col gap-2 pt-1 border-t border-gray-100">
            {deal.lastTouchSummary && (
              <div className="flex gap-2">
                <span className="text-xs text-gray-400 w-20 flex-shrink-0 pt-0.5">
                  Last touch
                </span>
                <span className="text-xs text-gray-700">
                  {deal.lastTouchSummary}
                </span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-xs text-gray-400 w-20 flex-shrink-0 pt-0.5">
                Days silent
              </span>
              <span className="text-xs text-gray-700">
                {deal.daysSinceLastTouch ?? 0} day
                {(deal.daysSinceLastTouch ?? 0) === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        {/* Draft editor */}
        <div className="flex flex-col gap-3">
          {/* Tone buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 mr-1">Tone:</span>
            {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
              <button
                key={t}
                onClick={() => handleToneChange(t)}
                disabled={generating}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                  tone === t
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-900"
                }`}
              >
                {TONE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Text area */}
          <div className="relative">
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={12}
              disabled={generating}
              className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-sm text-gray-800 leading-relaxed font-mono resize-none focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-all disabled:opacity-50"
            />
            {generating && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  Generating draft...
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Skip for now
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">via Gmail</span>
            <button
              onClick={handleSend}
              disabled={sending || generating || !editedText.trim()}
              className="bg-black text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DraftContent id={id} />
    </Suspense>
  );
}
