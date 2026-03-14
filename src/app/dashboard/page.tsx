"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useUser, UserButton } from "@stackframe/stack";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Settings, RefreshCw } from "lucide-react";
import { db } from "@/lib/db";

// Extended stage config to cover all HubSpot-mapped stages
const STAGE_CONFIG: Record<string, { color: string; bg: string; dot: string; label: string }> = {
  new_lead: {
    color: "text-slate-700", bg: "bg-slate-50 border-slate-200", dot: "bg-slate-500", label: "New lead",
  },
  outreach_sent: {
    color: "text-blue-700", bg: "bg-blue-50 border-blue-200", dot: "bg-blue-500", label: "Outreach sent",
  },
  replied_interested: {
    color: "text-green-700", bg: "bg-green-50 border-green-200", dot: "bg-green-500", label: "Replied / interested",
  },
  discovery_scheduled: {
    color: "text-cyan-700", bg: "bg-cyan-50 border-cyan-200", dot: "bg-cyan-500", label: "Discovery scheduled",
  },
  discovery_done: {
    color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200", dot: "bg-indigo-500", label: "Discovery done",
  },
  follow_up: {
    color: "text-amber-700", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-500", label: "Follow up",
  },
  demo_scheduled: {
    color: "text-purple-700", bg: "bg-purple-50 border-purple-200", dot: "bg-purple-500", label: "Demo scheduled",
  },
  paid_client: {
    color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500", label: "Paid client",
  },
  gone_silent: {
    color: "text-red-700", bg: "bg-red-50 border-red-200", dot: "bg-red-500", label: "Gone silent",
  },
  not_a_fit: {
    color: "text-gray-500", bg: "bg-gray-50 border-gray-200", dot: "bg-gray-400", label: "Not a fit",
  },
};

const DEFAULT_STAGE = {
  color: "text-gray-700", bg: "bg-gray-50 border-gray-200", dot: "bg-gray-500", label: "Unknown",
};

// Stages that need follow-up, sorted by urgency
const ACTIVE_STAGES = ["gone_silent", "follow_up", "discovery_done", "outreach_sent", "replied_interested", "discovery_scheduled", "demo_scheduled", "new_lead"];
const STAGE_URGENCY: Record<string, number> = Object.fromEntries(
  ACTIVE_STAGES.map((s, i) => [s, i])
);

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

function DashboardContent() {
  const user = useUser();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const autoSyncAttempted = useRef(false);
  const gmailWatchAttempted = useRef(false);

  // Query deals from InstantDB for the current user
  const { data, isLoading } = db.useQuery(
    user
      ? {
          deals: {
            $: { where: { "user.id": user.id } },
          },
          profiles: {
            $: { where: { "user.id": user.id } },
          },
        }
      : null
  );

  const deals = data?.deals ?? [];
  const profile = data?.profiles?.[0];

  // Sort deals by urgency
  const activeDealsSorted = [...deals]
    .filter((d) => ACTIVE_STAGES.includes(d.stage))
    .sort((a, b) => {
      const stageA = STAGE_URGENCY[a.stage] ?? 99;
      const stageB = STAGE_URGENCY[b.stage] ?? 99;
      if (stageA !== stageB) return stageA - stageB;
      return (b.daysSinceLastTouch ?? 0) - (a.daysSinceLastTouch ?? 0);
    });

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/hubspot/sync", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setSyncError(data.error ?? "Sync failed");
      }
    } catch {
      setSyncError("Network error during sync");
    } finally {
      setSyncing(false);
    }
  }, []);

  // Auto-sync on dashboard load if last sync > 30 min ago
  useEffect(() => {
    if (!user || autoSyncAttempted.current || isLoading) return;
    autoSyncAttempted.current = true;

    if (!profile?.hubspotAccessToken) return; // HubSpot not connected

    const lastSynced = profile?.hubspotLastSynced ?? 0;
    if (Date.now() - lastSynced > THIRTY_MINUTES_MS) {
      triggerSync();
    }
  }, [user, profile, isLoading, triggerSync]);

  // Register Gmail push notifications (once per session)
  useEffect(() => {
    if (!user || gmailWatchAttempted.current) return;
    gmailWatchAttempted.current = true;
    fetch("/api/gmail/watch", { method: "POST" }).catch(() => {});
  }, [user]);

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
          <button
            onClick={triggerSync}
            disabled={syncing || !profile?.hubspotAccessToken}
            title={!profile?.hubspotAccessToken ? "Connect HubSpot in Settings" : "Sync deals from HubSpot"}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 disabled:opacity-30"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          </button>
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
        {/* Sync status */}
        {syncError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {syncError}
          </div>
        )}

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-950">
            {isLoading
              ? "Loading deals..."
              : activeDealsSorted.length > 0
                ? `${activeDealsSorted.length} deal${activeDealsSorted.length === 1 ? "" : "s"} need follow-up`
                : "No deals need follow-up"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeDealsSorted.length > 0
              ? "Sorted by urgency. Start from the top."
              : profile?.hubspotAccessToken
                ? "All caught up, or sync to check for new deals."
                : "Connect HubSpot in Settings to import your deals."}
          </p>
        </div>

        {/* Deal list */}
        <div className="flex flex-col gap-3">
          {activeDealsSorted.map((deal) => {
            const stageConfig = STAGE_CONFIG[deal.stage] ?? DEFAULT_STAGE;
            return (
              <div
                key={deal.id}
                className="border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-2 min-w-0">
                    {/* Name + company */}
                    <div>
                      <p className="text-sm font-semibold text-gray-950">{deal.contactName}</p>
                      <p className="text-xs text-gray-500">
                        {deal.contactRole ? `${deal.contactRole} · ` : ""}
                        {deal.companyName}
                      </p>
                    </div>

                    {/* Stage pill */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${stageConfig.bg} ${stageConfig.color}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${stageConfig.dot}`} />
                        {stageConfig.label}
                      </span>
                    </div>

                    {/* Last touch */}
                    <p className="text-xs text-gray-500">
                      {deal.daysSinceLastTouch} day{deal.daysSinceLastTouch === 1 ? "" : "s"} since last touch
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
