"use client";

import { useState } from "react";
import Link from "next/link";
import RoastReport from "./components/RoastReport";
import ModeToggle from "./components/ModeToggle";
import ExportPdfButton from "./components/ExportPdfButton";
import HowItWorks from "./components/HowItWorks";
import SampleReportPreview from "./components/SampleReportPreview";
import Testimonials from "./components/Testimonials";
import FAQ from "./components/FAQ";
import ProgressIndicator from "./components/ProgressIndicator";
import { Report, ProgressStage, StreamEvent, RawScrapeData } from "./lib/types";
import { ExtractedSiteData } from "./lib/siteData";
import { useRawData } from "./components/RawDataProvider";
import { useReport } from "./components/ReportProvider";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeStage, setActiveStage] = useState<ProgressStage | null>(null);
  const { setRawScrape } = useRawData();
  const { report, setReport, mode, setMode, reportUrl, setReportUrl } = useReport();

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
    setActiveStage(null);

    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: normalizedUrl }),
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
          const event: StreamEvent<{
            report: Report;
            rawData: ExtractedSiteData;
            rawScrape: RawScrapeData;
          }> = JSON.parse(line);

          if (event.type === "stage") {
            setActiveStage(event.stage);
          } else if (event.type === "result") {
            setReport(event.data.report);
            setRawScrape(event.data.rawScrape);
            setReportUrl(normalizedUrl);
          } else if (event.type === "error") {
            setError(event.error);
          }
        }
      }
    } catch (err) {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
      setActiveStage(null);
    }
  };

  return (
    <main className="relative min-h-screen px-4 py-16 flex flex-col items-center">
      <Link
        href="/compare"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 px-4 py-2 border border-[var(--border)] rounded-full font-mono text-[11px] tracking-widest text-[var(--muted)] uppercase hover:text-[var(--amber)] hover:border-[var(--amber)] transition"
      >
        Comparison Mode
      </Link>

      {/* Hero */}
      <div className="w-full max-w-xl text-center mb-10">
        <div className="inline-block px-3 py-1 mb-4 border border-[var(--border)] rounded-full">
          <span className="font-mono text-[11px] tracking-widest text-[var(--muted)] uppercase">
            Website Diagnostic Tool
          </span>
        </div>
        <h1 className="font-display text-5xl md:text-6xl font-bold mb-3 tracking-tight">
          MAGPIE
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

      {loading && <ProgressIndicator stage={activeStage} />}

      {error && (
        <div className="mt-6 w-full max-w-xl bg-[#2a1616] border border-[var(--danger)] text-[#ffb4b4] px-4 py-3 rounded-lg font-mono text-sm">
          {error}
        </div>
      )}

      {report ? (
        <div className="mt-8 w-full max-w-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h2 className="font-display text-2xl font-bold">Your Report</h2>
            <div className="flex items-center gap-2">
              <ModeToggle mode={mode} onChange={setMode} />
              <ExportPdfButton report={report} mode={mode} url={reportUrl} />
              <Link
                href="/raw"
                className="px-4 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] font-mono text-xs tracking-wide uppercase text-[var(--muted)] transition hover:text-[var(--text)] hover:border-[var(--amber)]"
              >
                View Raw Data
              </Link>
            </div>
          </div>
          <RoastReport report={report} mode={mode} editable onChange={setReport} />
        </div>
      ) : (
        <>
          <HowItWorks />
          <SampleReportPreview />
          <Testimonials />
          <FAQ />
        </>
      )}
    </main>
  );
}
