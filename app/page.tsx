"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState("");

  const handleRoast = async () => {
    if (!url) {
      alert("Please enter a website URL first!");
      return;
    }

        // Auto-add https:// if the user didn't type a protocol
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    setLoading(true);
    setReport(null);
    setError("");

    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: normalizedUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
      } else {
        setReport(data.report);
      }
    } catch (err) {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Heat gauge calculation
  const score = report?.overallScore ?? 0;
  const gaugeAngle = (score / 100) * 180;
  const gaugeColor =
    score >= 70 ? "#7cb87f" : score >= 40 ? "#ffa940" : "#ff6b35";

  return (
    <main className="min-h-screen px-4 py-16 flex flex-col items-center">
      {/* Hero */}
      <div className="w-full max-w-xl text-center mb-10">
        <div className="inline-block px-3 py-1 mb-4 border border-[var(--border)] rounded-full">
          <span className="font-mono text-[11px] tracking-widest text-[var(--muted)] uppercase">
            Website Diagnostic Tool
          </span>
        </div>
        <h1 className="font-display text-5xl md:text-6xl font-bold mb-3 tracking-tight">
          ZYNTLOX
        </h1>
        <p className="text-[var(--muted)] max-w-md mx-auto leading-relaxed">
          Get brutally honest, actionable feedback for your website in under 60 seconds.
        </p>
      </div>

      {/* Input Card */}
      <div className="w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 scorched-top">
        <label className="font-mono text-[11px] tracking-widest text-[var(--muted)] uppercase mb-2 block">
          Target URL
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 px-4 py-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[var(--ember)] transition font-mono text-sm"
          />
          <button
            onClick={handleRoast}
            disabled={loading}
            className="px-6 py-3 rounded-lg font-display font-bold transition disabled:opacity-50 whitespace-nowrap"
            style={{
              background: "linear-gradient(135deg, var(--ember), var(--amber))",
              color: "#1a1614",
            }}
          >
            {loading ? "Scanning..." : "🔥 Roast It"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-6 w-full max-w-xl bg-[#2a1616] border border-[var(--danger)] text-[#ffb4b4] px-4 py-3 rounded-lg font-mono text-sm">
          {error}
        </div>
      )}

      {report && (
        <div className="mt-8 w-full max-w-2xl space-y-5">
          {/* Heat Gauge */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 flex flex-col items-center scorched-top">
            <span className="font-mono text-[11px] tracking-widest text-[var(--muted)] uppercase mb-4">
              Overall Score
            </span>
            <svg width="180" height="100" viewBox="0 0 180 100">
              <path
                d="M 10 90 A 80 80 0 0 1 170 90"
                fill="none"
                stroke="var(--border)"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <path
                d="M 10 90 A 80 80 0 0 1 170 90"
                fill="none"
                stroke={gaugeColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * gaugeAngle) / 180}
                style={{ transition: "stroke-dashoffset 1s ease-out" }}
              />
            </svg>
            <span className="font-mono text-4xl font-bold -mt-4" style={{ color: gaugeColor }}>
              {score}
              <span className="text-lg text-[var(--muted)]">/100</span>
            </span>
          </div>

          {/* First Impression */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
            <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--amber)] mb-2">
              👀 First Impression
            </h3>
            <p className="text-[var(--text)] opacity-90 leading-relaxed">
              {report.firstImpression}
            </p>
          </div>

          {/* Sub Scores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Design", value: report.designScore },
              { label: "Trust", value: report.trustScore },
              { label: "UX", value: report.uxScore },
              { label: "SEO", value: report.seoScore },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center"
              >
                <p className="font-mono text-[10px] tracking-widest text-[var(--muted)] uppercase mb-1">
                  {s.label}
                </p>
                <p className="font-mono text-2xl font-bold">{s.value}<span className="text-sm text-[var(--muted)]">/10</span></p>
              </div>
            ))}
          </div>

          {/* Biggest Problems */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
            <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--danger)] mb-4">
              ❌ Biggest Problems
            </h3>
            <div className="space-y-4">
              {report.biggestProblems?.map((p: any, i: number) => (
                <div key={i} className="dotted-divider pt-4 first:pt-0 first:border-0">
                  <p className="text-[var(--text)] opacity-90 mb-1">{p.issue}</p>
                  <p className="font-mono text-[11px] text-[var(--muted)] uppercase tracking-wide">
                    Impact: {p.impact} · Effort: {p.effort}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Wins */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
            <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--success)] mb-4">
              ✅ Quick Wins
            </h3>
            <ul className="space-y-2">
              {report.quickWins?.map((q: string, i: number) => (
                <li key={i} className="text-[var(--text)] opacity-90 flex gap-2">
                  <span className="text-[var(--success)] font-mono">→</span> {q}
                </li>
              ))}
            </ul>
          </div>

          {/* Suggestions */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
            <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--amber)] mb-4">
              💡 AI Suggestions
            </h3>
            <ul className="space-y-2">
              {report.suggestions?.map((s: string, i: number) => (
                <li key={i} className="text-[var(--text)] opacity-90 flex gap-2">
                  <span className="text-[var(--amber)] font-mono">→</span> {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
