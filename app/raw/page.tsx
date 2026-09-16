"use client";

import { useState } from "react";
import Link from "next/link";
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
      <main className="min-h-screen px-4 py-16 flex flex-col items-center text-center">
        <h1 className="font-display text-2xl font-bold mb-3">No Raw Data Yet</h1>
        <p className="text-[var(--muted)] max-w-md mb-6">
          Run a report first — the raw screenshot and markdown for a site only stick around
          for the current session.
        </p>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg font-mono text-xs tracking-wide uppercase"
          style={{
            background: "linear-gradient(135deg, var(--ember), var(--amber))",
            color: "#1a1614",
          }}
        >
          Back to Zyntlox
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
      `zyntlox-screenshot-${hostname}-${date}.png`
    );
  };

  const handleDownloadMarkdown = () => {
    if (!markdown) return;
    downloadBlob(
      new Blob([markdown], { type: "text/markdown" }),
      `zyntlox-markdown-${hostname}-${date}.md`
    );
  };

  return (
    <main className="min-h-screen px-4 py-16 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold">Raw Scrape Data</h1>
            <p className="font-mono text-xs text-[var(--muted)] mt-1">{url}</p>
          </div>
          <Link
            href="/"
            className="px-4 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] font-mono text-xs tracking-wide uppercase text-[var(--muted)] transition hover:text-[var(--text)] hover:border-[var(--amber)]"
          >
            Back to Report
          </Link>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--amber)]">
              Screenshot
            </h2>
            <button
              onClick={handleDownloadScreenshot}
              disabled={!screenshotBase64}
              className="px-3 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] font-mono text-[11px] tracking-wide uppercase text-[var(--muted)] transition hover:text-[var(--text)] hover:border-[var(--amber)] disabled:opacity-50"
            >
              Download PNG
            </button>
          </div>
          {screenshotBase64 ? (
            <div className="max-h-[600px] overflow-y-auto rounded-lg border border-[var(--border)]">
              <img
                src={`data:image/png;base64,${screenshotBase64}`}
                alt={`Screenshot of ${url}`}
                className="w-full block"
              />
            </div>
          ) : (
            <p className="text-[var(--muted)] text-sm">No screenshot was captured for this site.</p>
          )}
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--amber)]">
              Markdown
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleCopyMarkdown}
                disabled={!markdown}
                className="px-3 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] font-mono text-[11px] tracking-wide uppercase text-[var(--muted)] transition hover:text-[var(--text)] hover:border-[var(--amber)] disabled:opacity-50"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={handleDownloadMarkdown}
                disabled={!markdown}
                className="px-3 py-1 rounded-lg bg-[var(--bg)] border border-[var(--border)] font-mono text-[11px] tracking-wide uppercase text-[var(--muted)] transition hover:text-[var(--text)] hover:border-[var(--amber)] disabled:opacity-50"
              >
                Download .md
              </button>
            </div>
          </div>
          {markdown ? (
            <pre className="max-h-[600px] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 text-xs text-[var(--text)] whitespace-pre-wrap">
              {markdown}
            </pre>
          ) : (
            <p className="text-[var(--muted)] text-sm">No markdown was extracted for this site.</p>
          )}
        </div>
      </div>
    </main>
  );
}
