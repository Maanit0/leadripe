"use client";

import { Suspense, useState, useEffect, use } from "react";
import { useUser } from "@stackframe/stack";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { DEALS, STAGE_CONFIG, sortDealsByUrgency, Deal } from "@/lib/leads-data";

type Tone = "warm" | "shorter" | "bolder";

const TONE_LABELS: Record<Tone, string> = {
  warm: "Warm",
  shorter: "Shorter",
  bolder: "Bolder",
};

const sortedDeals = sortDealsByUrgency(DEALS);

function DraftContent({ id }: { id: string }) {
  const user = useUser();
  const router = useRouter();
  const deal = DEALS.find((d) => d.id === id);
  const [tone, setTone] = useState<Tone>("warm");
  const [sent, setSent] = useState(false);

  // Derive draft text directly from deal + tone (no effect needed)
  const draftText = deal ? deal.drafts[tone] : "";
  const [editedText, setEditedText] = useState(draftText);

  // When tone changes, reset edited text to the new draft
  const handleToneChange = (newTone: Tone) => {
    setTone(newTone);
    if (deal) setEditedText(deal.drafts[newTone]);
  };

  useEffect(() => {
    if (!user) {
      router.replace("/");
      return;
    }
    if (!deal) {
      router.replace("/dashboard");
    }
  }, [user, deal, router]);

  if (!deal || !user) return null;

  const stage = STAGE_CONFIG[deal.stage];

  // Next deal after this one
  const currentIndex = sortedDeals.findIndex((d) => d.id === id);
  const nextDeal: Deal | null = sortedDeals[currentIndex + 1] ?? null;

  const handleSend = () => {
    setSent(true);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm leading-none">L</span>
            </div>
            <span className="font-semibold text-gray-950 text-sm">LeadRipe</span>
          </div>
          <Link
            href="/dashboard"
            className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            Back to dashboard
          </Link>
        </header>

        <main className="max-w-xl mx-auto px-6 py-16">
          {/* Sent confirmation */}
          <div className="flex flex-col items-center gap-4 text-center mb-12">
            <div className="w-12 h-12 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-950">Sent to {deal.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">via Gmail</p>
            </div>
          </div>

          {/* Divider */}
          {nextDeal && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">Next up</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Next deal card */}
              <div className="border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-2 min-w-0">
                    <div>
                      <p className="text-sm font-semibold text-gray-950">{nextDeal.name}</p>
                      <p className="text-xs text-gray-500">
                        {nextDeal.role} · {nextDeal.company}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${
                          STAGE_CONFIG[nextDeal.stage].bg
                        } ${STAGE_CONFIG[nextDeal.stage].color}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${STAGE_CONFIG[nextDeal.stage].dot}`}
                        />
                        {nextDeal.stage}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {nextDeal.daysSince} days since last reply
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
              <p className="text-sm text-gray-500 mb-4">You&apos;ve cleared all your follow-ups. 🎉</p>
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
            <span className="text-white font-bold text-sm leading-none">L</span>
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
              <p className="text-base font-semibold text-gray-950">{deal.name}</p>
              <p className="text-sm text-gray-500">
                {deal.role} · {deal.company}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${
                stage.bg
              } ${stage.color}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
              {deal.stage}
            </span>
          </div>

          <div className="flex flex-col gap-2 pt-1 border-t border-gray-100">
            <div className="flex gap-2">
              <span className="text-xs text-gray-400 w-20 flex-shrink-0 pt-0.5">Last touch</span>
              <span className="text-xs text-gray-700">{deal.lastTouchSummary}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-xs text-gray-400 w-20 flex-shrink-0 pt-0.5">Goal</span>
              <span className="text-xs text-gray-700">{deal.goal}</span>
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
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
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
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={12}
            className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-sm text-gray-800 leading-relaxed font-mono resize-none focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-all"
          />
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
              className="bg-black text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-gray-900 transition-colors"
            >
              Send
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
