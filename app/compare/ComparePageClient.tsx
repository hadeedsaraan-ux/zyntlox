"use client";

import { useState } from "react";
import Link from "next/link";
import CompetitorComparison from "../components/CompetitorComparison";
import ModeToggle from "../components/ModeToggle";
import ProgressIndicator from "../components/ProgressIndicator";
import { ComparisonReport, ReportMode, ProgressStage, StreamEvent } from "../lib/types";

export default function ComparePageClient() {
  const [yourUrl, setYourUrl] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState<ComparisonReport | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<ReportMode>("technical");
  const [activeStage, setActiveStage] = useState<ProgressStage | null>(null);

  const handleCompare = async () => {
    if (!yourUrl || !competitorUrl) {
      alert("Please enter both website URLs first!");
      return;
    }

    // Auto-add https:// if the user didn't type a protocol
    const normalize = (u: string) => {
      const trimmed = u.trim();
      return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    };

    setLoading(true);
    setComparison(null);
    setError("");
    setActiveStage(null);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yourUrl: normalize(yourUrl),
          competitorUrl: normalize(competitorUrl),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong.");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event: StreamEvent<{ comparison: ComparisonReport }> = JSON.parse(line);

          if (event.type === "stage") {
            setActiveStage(event.stage);
          } else if (event.type === "result") {
            setComparison(event.data.comparison);
          } else if (event.type === "error") {
            setError(event.error);
          }
        }
      }
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
      setActiveStage(null);
    }
  };

  return (
    <main className="min-h-screen px-4 py-16 flex flex-col items-center">
      <div className="w-full max-w-xl mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono text-[11px] tracking-widest text-[var(--muted)] uppercase hover:text-[var(--amber)] transition"
        >
          ← Back to ZYNTLOX
        </Link>
      </div>

      {/* Hero */}
      <div className="w-full max-w-xl text-center mb-10">
        <div className="inline-block px-3 py-1 mb-4 border border-[var(--border)] rounded-full">
          <span className="font-mono text-[11px] tracking-widest text-[var(--muted)] uppercase">
            Competitor Analysis
          </span>
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold mb-3 tracking-tight">
          Compare Head-to-Head
        </h1>
        <p className="text-[var(--muted)] max-w-md mx-auto leading-relaxed">
          See exactly how your website stacks up against a competitor&apos;s — design, trust, UX, and SEO, side by side.
        </p>
      </div>

      {/* Input Card */}
      <div className="w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 scorched-top">
        <div className="mb-4">
          <label className="font-mono text-[11px] tracking-widest text-[var(--muted)] uppercase mb-2 block">
            Your URL
          </label>
          <input
            type="text"
            placeholder="https://yoursite.com"
            value={yourUrl}
            onChange={(e) => setYourUrl(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[var(--ember)] transition font-mono text-sm"
          />
        </div>
        <div className="mb-4">
          <label className="font-mono text-[11px] tracking-widest text-[var(--muted)] uppercase mb-2 block">
            Competitor&apos;s URL
          </label>
          <input
            type="text"
            placeholder="https://competitor.com"
            value={competitorUrl}
            onChange={(e) => setCompetitorUrl(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[var(--ember)] transition font-mono text-sm"
          />
        </div>
        <button
          onClick={handleCompare}
          disabled={loading}
          className="w-full px-6 py-3 rounded-lg font-display font-bold transition disabled:opacity-50 whitespace-nowrap"
          style={{
            background: "linear-gradient(135deg, var(--ember), var(--amber))",
            color: "#1a1614",
          }}
        >
          {loading ? "Comparing..." : "⚔️ Compare It"}
        </button>
      </div>

      {loading && <ProgressIndicator stage={activeStage} />}

      {error && (
        <div className="mt-6 w-full max-w-xl bg-[#2a1616] border border-[var(--danger)] text-[#ffb4b4] px-4 py-3 rounded-lg font-mono text-sm">
          {error}
        </div>
      )}

      {comparison && (
        <div className="mt-8 w-full max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h2 className="font-display text-2xl font-bold">Comparison Report</h2>
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
          <CompetitorComparison comparison={comparison} mode={mode} />
        </div>
      )}
    </main>
  );
}
