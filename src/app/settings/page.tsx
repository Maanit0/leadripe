"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useUser } from "@stackframe/stack";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, AlertCircle } from "lucide-react";
import { db } from "@/lib/db";

function SettingsContent() {
  const user = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirected = useRef(false);

  // Query the user's profile from InstantDB
  const { data } = db.useQuery(
    user ? { profiles: { $: { where: { "user.id": user.id } } } } : null
  );
  const profile = data?.profiles?.[0];
  const hubspotConnected = !!profile?.hubspotAccessToken;
  const notionConnected = !!profile?.notionAccessToken;

  const [toggling, setToggling] = useState<string | null>(null);

  // HubSpot token input
  const [hubspotToken, setHubspotToken] = useState("");
  const [hubspotSaving, setHubspotSaving] = useState(false);
  const [hubspotError, setHubspotError] = useState<string | null>(null);
  const [hubspotSaved, setHubspotSaved] = useState(false);

  // Calendly
  const [calendlyUrl, setCalendlyUrl] = useState("");
  const [saved, setSaved] = useState(false);

  // Seed Calendly from InstantDB
  useEffect(() => {
    if (profile) {
      const stored =
        (profile.calendlyLink as string) ||
        (typeof window !== "undefined"
          ? localStorage.getItem("leadripe_calendly") ?? ""
          : "");
      setCalendlyUrl(stored);
    }
  }, [profile]);

  useEffect(() => {
    if (!user && !redirected.current) {
      redirected.current = true;
      router.replace("/");
    }
  }, [user, router]);

  const handleDisconnect = async (key: string) => {
    setToggling(key);
    try {
      await fetch(`/api/integrations/${key}/disconnect`, { method: "DELETE" });
    } finally {
      setToggling(null);
    }
  };

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
        setHubspotSaved(true);
        setHubspotToken("");
        setTimeout(() => setHubspotSaved(false), 3000);
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

  const handleSaveCalendly = async () => {
    if (profile) {
      await db.transact(
        db.tx.profiles[profile.id]!.update({ calendlyLink: calendlyUrl })
      );
    }
    localStorage.setItem("leadripe_calendly", calendlyUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignOut = () => {
    localStorage.removeItem("leadripe_onboarding_done");
    user?.signOut();
  };

  if (!user) return null;

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

      <main className="max-w-xl mx-auto px-6 py-10 flex flex-col gap-10">
        <h1 className="text-xl font-semibold text-gray-950">Settings</h1>

        {/* Notion OAuth status banner */}
        {searchParams.get("notion") === "connected" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            <Check className="w-4 h-4" />
            Notion connected successfully
          </div>
        )}
        {searchParams.get("notion") === "error" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertCircle className="w-4 h-4" />
            Failed to connect Notion. Please try again.
          </div>
        )}

        {/* HubSpot — Personal Access Token */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">HubSpot</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Paste your{" "}
              <a
                href="https://app.hubspot.com/portal-recommend/l?slug=private-apps"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-700"
              >
                Private App access token
              </a>{" "}
              with CRM deals and contacts scopes
            </p>
          </div>

          {hubspotConnected ? (
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-2 text-green-600">
                <Check className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Connected</span>
              </div>
              <button
                onClick={() => handleDisconnect("hubspot")}
                disabled={toggling === "hubspot"}
                className="text-xs font-medium px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {toggling === "hubspot" ? "..." : "Disconnect"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="password"
                  value={hubspotToken}
                  onChange={(e) => {
                    setHubspotToken(e.target.value);
                    setHubspotError(null);
                    setHubspotSaved(false);
                  }}
                  placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-all font-mono"
                />
                <button
                  onClick={handleSaveHubspotToken}
                  disabled={!hubspotToken.trim() || hubspotSaving}
                  className={`text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                    hubspotSaved
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-black text-white hover:bg-gray-900 disabled:opacity-30"
                  }`}
                >
                  {hubspotSaving
                    ? "..."
                    : hubspotSaved
                      ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Saved
                        </>
                      )
                      : "Save"}
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
        </section>

        {/* Connected accounts */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Connected accounts
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage your integrations
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {/* Gmail — auto-connected via Google sign-in */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-gray-900">Gmail</span>
                <span className="text-xs text-gray-500">
                  Send follow-ups from your inbox
                </span>
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <Check className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Via Google sign-in</span>
              </div>
            </div>

            {/* Notion — OAuth */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-gray-900">Notion</span>
                <span className="text-xs text-gray-500">
                  Deal notes and updates
                </span>
              </div>
              <div className="flex items-center gap-3">
                {notionConnected && (
                  <div className="flex items-center gap-1 text-green-600">
                    <Check className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Connected</span>
                  </div>
                )}
                <button
                  onClick={
                    notionConnected
                      ? () => handleDisconnect("notion")
                      : () => {
                          window.location.href =
                            "/api/integrations/notion/connect";
                        }
                  }
                  disabled={toggling === "notion"}
                  className={`text-xs font-medium px-3 py-1.5 border rounded-lg transition-colors disabled:opacity-50 ${
                    notionConnected
                      ? "border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {toggling === "notion"
                    ? "..."
                    : notionConnected
                      ? "Disconnect"
                      : "Connect"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Calendly */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Calendly</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Your booking link for leads
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              value={calendlyUrl}
              onChange={(e) => {
                setCalendlyUrl(e.target.value);
                setSaved(false);
              }}
              placeholder="https://calendly.com/yourname/30min"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-all"
            />
            <button
              onClick={handleSaveCalendly}
              disabled={!calendlyUrl.trim()}
              className={`text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                saved
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-black text-white hover:bg-gray-900 disabled:opacity-30"
              }`}
            >
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Saved
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </section>

        {/* Account */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Account</h2>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-500">Email</span>
                <span className="text-sm text-gray-900">
                  {user.primaryEmail}
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors text-left"
            >
              Sign out
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
