"use client";

import { Suspense, useState, useEffect } from "react";
import { useUser } from "@stackframe/stack";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, AlertCircle } from "lucide-react";
import { db } from "@/lib/db";

function OnboardingContent() {
  const user = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [calendlyUrl, setCalendlyUrl] = useState("");

  // HubSpot token input
  const [hubspotToken, setHubspotToken] = useState("");
  const [hubspotSaving, setHubspotSaving] = useState(false);
  const [hubspotError, setHubspotError] = useState<string | null>(null);

  // Read connected state from InstantDB
  const { data } = db.useQuery(
    user ? { profiles: { $: { where: { "user.id": user.id } } } } : null
  );
  const profile = data?.profiles?.[0];

  const hubspotConnected = !!profile?.hubspotAccessToken;
  const notionConnected = !!profile?.notionAccessToken;
  // Gmail is auto-connected via Stack Auth Google sign-in
  const gmailConnected = true;

  useEffect(() => {
    if (!user) {
      router.replace("/");
    }
  }, [user, router]);

  const allConnected = hubspotConnected && gmailConnected && notionConnected;

  const handleSaveHubspotToken = async () => {
    if (!hubspotToken.trim()) return;
    setHubspotSaving(true);
    setHubspotError(null);
    try {
      const res = await fetch("/api/integrations/hubspot/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: hubspotToken }),
      });
      if (res.ok) {
        setHubspotToken("");
      } else {
        const data = await res.json();
        setHubspotError(data.error ?? "Failed to save token");
      }
    } catch {
      setHubspotError("Network error");
    } finally {
      setHubspotSaving(false);
    }
  };

  const handleFinish = async () => {
    localStorage.setItem("leadripe_onboarding_done", "true");

    if (calendlyUrl.trim() && profile) {
      await db.transact(
        db.tx.profiles[profile.id]!.update({ calendlyLink: calendlyUrl })
      );
    }
    if (calendlyUrl.trim()) {
      localStorage.setItem("leadripe_calendly", calendlyUrl);
    }

    setStep(3);
  };

  // Count deals from InstantDB for the success screen
  const { data: dealsData } = db.useQuery(
    user ? { deals: { $: { where: { "user.id": user.id } } } } : null
  );
  const dealCount = dealsData?.deals?.length ?? 0;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm leading-none">
              L
            </span>
          </div>
          <span className="font-semibold text-gray-950 text-sm">LeadRipe</span>
        </div>
        {step < 3 && (
          <div className="flex items-center gap-1.5">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-1 w-8 rounded-full transition-colors ${
                  s <= step ? "bg-black" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center pt-16 px-6">
        <div className="w-full max-w-md">
          {step === 1 && (
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-xl font-semibold text-gray-950">
                  Connect your accounts
                </h2>
                <p className="text-sm text-gray-500">
                  LeadRipe works best when connected to your existing tools.
                </p>
              </div>

              {/* Notion OAuth status banner */}
              {searchParams.get("notion") === "connected" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
                  <Check className="w-4 h-4" />
                  Notion connected successfully
                </div>
              )}
              {searchParams.get("notion") === "error" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  Failed to connect Notion. Please try again.
                </div>
              )}

              <div className="flex flex-col gap-3">
                {/* HubSpot — token paste */}
                <div className="p-4 border border-gray-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-gray-900">
                        HubSpot
                      </span>
                      <span className="text-xs text-gray-500">
                        Sync your CRM contacts and pipeline
                      </span>
                    </div>
                    {hubspotConnected && (
                      <div className="flex items-center gap-1.5 text-green-600">
                        <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </div>
                        <span className="text-xs font-medium">Connected</span>
                      </div>
                    )}
                  </div>
                  {!hubspotConnected && (
                    <div className="flex flex-col gap-2 mt-3">
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={hubspotToken}
                          onChange={(e) => {
                            setHubspotToken(e.target.value);
                            setHubspotError(null);
                          }}
                          placeholder="Paste access token"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-all font-mono"
                        />
                        <button
                          onClick={handleSaveHubspotToken}
                          disabled={!hubspotToken.trim() || hubspotSaving}
                          className="text-xs font-medium px-3 py-2 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-30"
                        >
                          {hubspotSaving ? "..." : "Save"}
                        </button>
                      </div>
                      {hubspotError && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {hubspotError}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Gmail — auto-connected */}
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-gray-900">
                      Gmail
                    </span>
                    <span className="text-xs text-gray-500">
                      Send follow-ups directly from your inbox
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-green-600">
                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                    <span className="text-xs font-medium">Via Google</span>
                  </div>
                </div>

                {/* Notion — OAuth */}
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-gray-900">
                      Notion
                    </span>
                    <span className="text-xs text-gray-500">
                      Log deal notes and updates
                    </span>
                  </div>
                  {notionConnected ? (
                    <div className="flex items-center gap-1.5 text-green-600">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                      <span className="text-xs font-medium">Connected</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        window.location.href =
                          "/api/integrations/notion/connect?return_to=/onboarding";
                      }}
                      className="text-xs font-medium px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!allConnected}
                className="w-full bg-black text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-xl font-semibold text-gray-950">
                  Add your Calendly link
                </h2>
                <p className="text-sm text-gray-500">
                  Paste your Calendly link so leads can book time easily.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  className="text-xs font-medium text-gray-700"
                  htmlFor="calendly"
                >
                  Calendly URL
                </label>
                <input
                  id="calendly"
                  type="url"
                  value={calendlyUrl}
                  onChange={(e) => setCalendlyUrl(e.target.value)}
                  placeholder="https://calendly.com/yourname/30min"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-all"
                />
              </div>

              <button
                onClick={handleFinish}
                disabled={!calendlyUrl.trim()}
                className="w-full bg-black text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center gap-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-14 h-14 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-center">
                  <Check className="w-7 h-7 text-green-600" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-xl font-semibold text-gray-950">
                    LeadRipe is ready.
                  </h2>
                  {dealCount > 0 && (
                    <p className="text-sm text-gray-500">
                      We found{" "}
                      <span className="font-semibold text-gray-900">
                        {dealCount} deals
                      </span>{" "}
                      that need follow-up.
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => router.push("/dashboard")}
                className="w-full bg-black text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-900 transition-colors"
              >
                Open dashboard
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
