"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "../components/Icons";
import { useRawData } from "../components/RawDataProvider";

function base64ToBlob(base64: string, type: string): Blob {
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type });
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "report";
  }
}

export default function RawDataPage() {
  const { rawScrape } = useRawData();
  const [copied, setCopied] = useState(false);

  if (!rawScrape) {
    return (
      <main className="flex flex-col items-center px-4 pt-24 text-center">
        <p className="eyebrow mb-3">Raw data</p>
        <h1 className="mb-3 font-display text-4xl">Nothing here yet</h1>
        <p className="mb-6 max-w-md text-muted">
          Run a report first — the raw screenshot and markdown for a site only stick around
          for the current session.
        </p>
        <Link href="/" className="btn-primary px-5 py-2.5 text-sm">
          Inspect a site
        </Link>
      </main>
    );
  }

  const { url, screenshotBase64, markdown } = rawScrape;
  const hostname = hostnameOf(url);
  const date = new Date().toISOString().slice(0, 10);

  const handleCopyMarkdown = async () => {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownloadScreenshot = () => {
    if (!screenshotBase64) return;
    downloadBlob(
      base64ToBlob(screenshotBase64, "image/png"),
      `magpie-screenshot-${hostname}-${date}.png`
    );
  };

  const handleDownloadMarkdown = () => {
    if (!markdown) return;
    downloadBlob(
      new Blob([markdown], { type: "text/markdown" }),
      `magpie-markdown-${hostname}-${date}.md`
    );
  };

  return (
    <main className="flex flex-col items-center px-4 pt-14 sm:px-6">
      <div className="w-full max-w-3xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow mb-2">What Magpie saw</p>
            <h1 className="font-display text-4xl">Raw scrape data</h1>
            <p className="mt-1 truncate font-mono text-xs text-muted">{url}</p>
          </div>
          <Link href="/" className="btn-ghost px-3.5 py-2 text-sm">
            <ArrowLeftIcon className="h-4 w-4" /> Back to report
          </Link>
        </div>

        <div className="card mb-4 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl">
              Screenshot
            </h2>
            <button
              onClick={handleDownloadScreenshot}
              disabled={!screenshotBase64}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              Download PNG
            </button>
          </div>
          {screenshotBase64 ? (
            <div className="max-h-[600px] overflow-y-auto rounded-xl border border-line">
              <img
                src={`data:image/png;base64,${screenshotBase64}`}
                alt={`Screenshot of ${url}`}
                className="w-full block"
              />
            </div>
          ) : (
            <p className="text-sm text-muted">No screenshot was captured for this site.</p>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl">
              Markdown
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleCopyMarkdown}
                disabled={!markdown}
                className="btn-ghost px-3 py-1.5 text-xs"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={handleDownloadMarkdown}
                disabled={!markdown}
                className="btn-ghost px-3 py-1.5 text-xs"
              >
                Download .md
              </button>
            </div>
          </div>
          {markdown ? (
            <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-surface-2 p-4 font-mono text-xs text-ink">
              {markdown}
            </pre>
          ) : (
            <p className="text-sm text-muted">No markdown was extracted for this site.</p>
          )}
        </div>
      </div>
    </main>
  );
}
