"use client";

import { useState } from "react";
import { Report, ReportMode } from "../lib/types";

export default function ExportPdfButton({
  report,
  mode,
  url,
}: {
  report: Report;
  mode: ReportMode;
  url: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    setError(false);

    try {
      const [{ pdf }, { default: ReportDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("../lib/pdf/ReportDocument"),
      ]);

      const blob = await pdf(
        <ReportDocument report={report} mode={mode} url={url} />
      ).toBlob();

      const objectUrl = URL.createObjectURL(blob);
      const hostname = (() => {
        try {
          return new URL(url).hostname;
        } catch {
          return "report";
        }
      })();
      const date = new Date().toISOString().slice(0, 10);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `zyntlox-report-${hostname}-${date}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="px-4 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] font-mono text-xs tracking-wide uppercase text-[var(--muted)] transition hover:text-[var(--text)] hover:border-[var(--amber)] disabled:opacity-50"
    >
      {exporting ? "Exporting…" : error ? "Export Failed — Retry" : "Export PDF"}
    </button>
  );
}
