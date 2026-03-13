"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useUser } from "@stackframe/stack";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";

type ConnectionKey = "hubspot" | "gmail" | "notion";

const CONNECTIONS: { key: ConnectionKey; name: string; description: string }[] = [
  { key: "hubspot", name: "HubSpot", description: "CRM contacts and pipeline" },
  { key: "gmail", name: "Gmail", description: "Send follow-ups from your inbox" },
  { key: "notion", name: "Notion", description: "Deal notes and updates" },
];

function SettingsContent() {
  const user = useUser();
  const router = useRouter();
  const [connected, setConnected] = useState<Record<ConnectionKey, boolean>>({
    hubspot: true,
    gmail: true,
    notion: true,
  });
  const [toggling, setToggling] = useState<ConnectionKey | null>(null);
  // Lazy initializer reads localStorage only on client (avoids SSR mismatch)
  const [calendlyUrl, setCalendlyUrl] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("leadripe_calendly") ?? "";
  });
  const [saved, setSaved] = useState(false);
  const redirected = useRef(false);

  useEffect(() => {
    if (!user && !redirected.current) {
      redirected.current = true;
      router.replace("/");
    }
  }, [user, router]);

  const handleToggle = (key: ConnectionKey) => {
    setToggling(key);
    setTimeout(() => {
      setConnected((prev) => ({ ...prev, [key]: !prev[key] }));
      setToggling(null);
    }, 700);
  };

  const handleSaveCalendly = () => {
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

        {/* Connected accounts */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Connected accounts</h2>
            <p className="text-xs text-gray-500 mt-0.5">Manage your integrations</p>
          </div>

          <div className="flex flex-col gap-2">
            {CONNECTIONS.map(({ key, name, description }) => (
              <div
                key={key}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-xl"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-gray-900">{name}</span>
                  <span className="text-xs text-gray-500">{description}</span>
                </div>
                <div className="flex items-center gap-3">
                  {connected[key] && (
                    <div className="flex items-center gap-1 text-green-600">
                      <Check className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Connected</span>
                    </div>
                  )}
                  <button
                    onClick={() => handleToggle(key)}
                    disabled={toggling === key}
                    className={`text-xs font-medium px-3 py-1.5 border rounded-lg transition-colors disabled:opacity-50 ${
                      connected[key]
                        ? "border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {toggling === key ? "..." : connected[key] ? "Disconnect" : "Connect"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Calendly */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Calendly</h2>
            <p className="text-xs text-gray-500 mt-0.5">Your booking link for leads</p>
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
                <span className="text-sm text-gray-900">{user.primaryEmail}</span>
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
