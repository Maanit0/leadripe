"use client";

import { Suspense, useState, useEffect } from "react";
import { useUser } from "@stackframe/stack";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { DEALS } from "@/lib/leads-data";

type ConnectionKey = "hubspot" | "gmail" | "notion";

const CONNECTIONS: { key: ConnectionKey; name: string; description: string }[] = [
  { key: "hubspot", name: "HubSpot", description: "Sync your CRM contacts and pipeline" },
  { key: "gmail", name: "Gmail", description: "Send follow-ups directly from your inbox" },
  { key: "notion", name: "Notion", description: "Log deal notes and updates" },
];

function OnboardingContent() {
  const user = useUser();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [connected, setConnected] = useState<Record<ConnectionKey, boolean>>({
    hubspot: false,
    gmail: false,
    notion: false,
  });
  const [connecting, setConnecting] = useState<ConnectionKey | null>(null);
  const [calendlyUrl, setCalendlyUrl] = useState("");

  useEffect(() => {
    if (!user) {
      router.replace("/");
    }
  }, [user, router]);

  const allConnected = Object.values(connected).every(Boolean);

  const handleConnect = (key: ConnectionKey) => {
    setConnecting(key);
    setTimeout(() => {
      setConnected((prev) => ({ ...prev, [key]: true }));
      setConnecting(null);
    }, 900);
  };

  const handleFinish = () => {
    localStorage.setItem("leadripe_onboarding_done", "true");
    if (calendlyUrl) {
      localStorage.setItem("leadripe_calendly", calendlyUrl);
    }
    setStep(3);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm leading-none">L</span>
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
                <h2 className="text-xl font-semibold text-gray-950">Connect your accounts</h2>
                <p className="text-sm text-gray-500">
                  LeadRipe works best when connected to your existing tools.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {CONNECTIONS.map(({ key, name, description }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-xl"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-gray-900">{name}</span>
                      <span className="text-xs text-gray-500">{description}</span>
                    </div>
                    {connected[key] ? (
                      <div className="flex items-center gap-1.5 text-green-600">
                        <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </div>
                        <span className="text-xs font-medium">Connected</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConnect(key)}
                        disabled={connecting === key}
                        className="text-xs font-medium px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        {connecting === key ? "Connecting..." : "Connect"}
                      </button>
                    )}
                  </div>
                ))}
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
                <h2 className="text-xl font-semibold text-gray-950">Add your Calendly link</h2>
                <p className="text-sm text-gray-500">
                  Paste your Calendly link so leads can book time easily.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-700" htmlFor="calendly">
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
                  <h2 className="text-xl font-semibold text-gray-950">LeadRipe is ready.</h2>
                  <p className="text-sm text-gray-500">
                    We found{" "}
                    <span className="font-semibold text-gray-900">{DEALS.length} deals</span>{" "}
                    that need follow-up.
                  </p>
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
