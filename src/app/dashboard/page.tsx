"use client";

import { Suspense, useEffect } from "react";
import { useUser, UserButton } from "@stackframe/stack";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Settings } from "lucide-react";
import { DEALS, STAGE_CONFIG, sortDealsByUrgency } from "@/lib/leads-data";

const sortedDeals = sortDealsByUrgency(DEALS);

function DashboardContent() {
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace("/");
    }
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm leading-none">L</span>
          </div>
          <span className="font-semibold text-gray-950 text-sm">LeadRipe</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <UserButton />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-950">
            {sortedDeals.length} deals need follow-up today
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Sorted by urgency. Start from the top.
          </p>
        </div>

        {/* Deal list */}
        <div className="flex flex-col gap-3">
          {sortedDeals.map((deal) => {
            const stage = STAGE_CONFIG[deal.stage];
            return (
              <div
                key={deal.id}
                className="border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-2 min-w-0">
                    {/* Name + company */}
                    <div>
                      <p className="text-sm font-semibold text-gray-950">{deal.name}</p>
                      <p className="text-xs text-gray-500">
                        {deal.role} · {deal.company}
                      </p>
                    </div>

                    {/* Stage pill */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${
                          stage.bg
                        } ${stage.color}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
                        {deal.stage}
                      </span>
                    </div>

                    {/* Last touch */}
                    <p className="text-xs text-gray-500">
                      {deal.daysSince} days since last reply
                    </p>
                  </div>

                  {/* Action */}
                  <div className="flex-shrink-0">
                    <Link
                      href={`/dashboard/draft/${deal.id}`}
                      className="inline-flex items-center bg-black text-white text-xs font-medium px-3.5 py-2 rounded-lg hover:bg-gray-900 transition-colors whitespace-nowrap"
                    >
                      Review draft
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
