"use client";

import { useState } from "react";
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
      setError("Enter both website addresses to compare them.");
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
    <main className="flex flex-col items-center px-4 sm:px-6">
      <section className="relative w-full max-w-3xl pt-16 pb-10 text-center sm:pt-20">
        <p className="eyebrow mb-5">Head-to-head</p>
        <h1 className="font-display text-[2.6rem] leading-[1.04] sm:text-6xl">
          You versus the <em className="sheen-text pr-1">competition.</em>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">
          Magpie inspects both sites against the same checklist, then explains exactly where
          each one is ahead — design, trust, UX and SEO — and what to fix first.
        </p>

        <form
          className="relative mx-auto mt-10 max-w-xl text-left"
          onSubmit={(e) => {
            e.preventDefault();
            handleCompare();
          }}
        >
          <div aria-hidden="true" className="hero-glow pointer-events-none absolute -inset-10 -z-10" />
          <div className="card space-y-4 p-5 sm:p-6">
            <div>
              <label htmlFor="your-url" className="mb-1.5 block text-sm font-medium text-ink-soft">
                Your site
              </label>
              <input
                id="your-url"
                type="text"
                inputMode="url"
                placeholder="yoursite.com"
                value={yourUrl}
                onChange={(e) => setYourUrl(e.target.value)}
                className="field px-4 py-3 font-mono text-[15px]"
              />
            </div>
            <div>
              <label htmlFor="competitor-url" className="mb-1.5 block text-sm font-medium text-ink-soft">
                Competitor&apos;s site
              </label>
              <input
                id="competitor-url"
                type="text"
                inputMode="url"
                placeholder="competitor.com"
                value={competitorUrl}
                onChange={(e) => setCompetitorUrl(e.target.value)}
                className="field px-4 py-3 font-mono text-[15px]"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full px-6 py-3 text-[15px]">
              {loading ? "Comparing…" : "Compare sites"}
            </button>
          </div>
          <p className="mt-4 text-center font-mono text-[11px] tracking-wide text-muted">
            Takes about a minute · Nothing stored
          </p>
        </form>

        {loading && <ProgressIndicator stage={activeStage} />}

        {error && (
          <div
            role="alert"
            className="mx-auto mt-6 max-w-xl rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-left text-sm text-danger"
          >
            {error}
          </div>
        )}
      </section>

      {comparison && (
        <section className="w-full max-w-5xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <p className="eyebrow">The comparison</p>
              <h2 className="font-display text-3xl">Head-to-head verdict</h2>
            </div>
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
          <CompetitorComparison comparison={comparison} mode={mode} />
        </section>
      )}
    </main>
  );
}
