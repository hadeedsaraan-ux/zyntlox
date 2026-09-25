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
import WhatWeCheck from "./components/WhatWeCheck";
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
    if (!url.trim()) {
      setError("Enter a website address for Magpie to inspect.");
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
    <main className="relative flex flex-col items-center px-4 sm:px-6">
      {/* Hero */}
      <section className="relative w-full max-w-3xl pt-16 pb-10 text-center sm:pt-24">
        <p className="eyebrow mb-5">Website review · under 60 seconds</p>
        <h1 className="font-display text-[2.9rem] leading-[1.02] sm:text-7xl">
          Every flaw on your site,{" "}
          <em className="sheen-text pr-1">spotted.</em>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Magpie reads your page the way a first-time visitor does, then tells you — bluntly —
          what&apos;s costing you trust, leads and sales, and how to fix it.
        </p>

        <form
          className="relative mx-auto mt-10 max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            handleRoast();
          }}
        >
          <div aria-hidden="true" className="hero-glow pointer-events-none absolute -inset-10 -z-10" />
          <div className="card flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
            <label htmlFor="url" className="sr-only">
              Website URL
            </label>
            <input
              id="url"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="yourwebsite.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full flex-1 bg-transparent px-4 py-3 font-mono text-[15px] text-ink outline-none placeholder:text-muted/80"
            />
            <button type="submit" disabled={loading} className="btn-primary px-6 py-3 text-[15px]">
              {loading ? "Inspecting…" : "Inspect my site"}
            </button>
          </div>
          <p className="mt-4 font-mono text-[11px] tracking-wide text-muted">
            No sign-up · Nothing stored · Free while in beta
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

      {report ? (
        <section className="w-full max-w-3xl">
          <div className="sticky top-16 z-20 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper/85 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-b-xl sm:px-1">
            <div className="min-w-0">
              <p className="eyebrow">The verdict</p>
              <p className="truncate font-mono text-sm text-ink-soft">{reportUrl}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ModeToggle mode={mode} onChange={setMode} />
              <ExportPdfButton report={report} mode={mode} url={reportUrl} />
              <Link href="/raw" className="btn-ghost px-3 py-1.5 text-xs">
                Raw data
              </Link>
            </div>
          </div>
          <RoastReport report={report} mode={mode} editable onChange={setReport} />
        </section>
      ) : (
        <>
          <WhatWeCheck />
          <HowItWorks />
          <SampleReportPreview />
          <Testimonials />
          <FAQ />
        </>
      )}
    </main>
  );
}
