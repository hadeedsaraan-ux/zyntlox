"use client";

import { useState } from "react";
import RoastReport from "./components/RoastReport";
import ModeToggle from "./components/ModeToggle";
import HowItWorks from "./components/HowItWorks";
import SampleReportPreview from "./components/SampleReportPreview";
import { Report, ReportMode } from "./lib/types";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<ReportMode>("technical");

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

      {report ? (
        <div className="mt-8 w-full max-w-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h2 className="font-display text-2xl font-bold">Your Report</h2>
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
          <RoastReport report={report} mode={mode} />
        </div>
      ) : (
        <>
          <HowItWorks />
          <SampleReportPreview />
        </>
      )}
    </main>
  );
}
