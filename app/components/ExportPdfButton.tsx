"use client";

import { useRef, useState } from "react";
import { Report, ReportMode } from "../lib/types";
import { useReport } from "./ReportProvider";

export default function ExportPdfButton({
  report,
  mode,
  url,
}: {
  report: Report;
  mode: ReportMode;
  url: string;
}) {
  const { agencyName, setAgencyName, agencyLogoDataUri, setAgencyLogoDataUri } = useReport();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAgencyLogoDataUri(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleExport = async () => {
    setExporting(true);
    setError(false);

    try {
      const [{ pdf }, { default: ReportDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("../lib/pdf/ReportDocument"),
      ]);

      const blob = await pdf(
        <ReportDocument
          report={report}
          mode={mode}
          url={url}
          agencyName={agencyName || undefined}
          agencyLogoDataUri={agencyLogoDataUri || undefined}
        />
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
      const filenamePrefix = agencyName
        ? agencyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "report"
        : "zyntlox-report";

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${filenamePrefix}-${hostname}-${date}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-4 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] font-mono text-xs tracking-wide uppercase text-[var(--muted)] transition hover:text-[var(--text)] hover:border-[var(--amber)]"
      >
        {error ? "Export Failed — Retry" : "Export PDF"}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-72 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 shadow-lg">
          <p className="font-mono text-[10px] tracking-widest text-[var(--muted)] uppercase mb-3">
            Brand This PDF (optional)
          </p>

          <label className="block font-mono text-[10px] text-[var(--muted)] uppercase mb-1">
            Agency Name
          </label>
          <input
            type="text"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            placeholder="Defaults to Zyntlox"
            className="w-full mb-3 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[var(--amber)] transition font-mono text-xs"
          />

          <label className="block font-mono text-[10px] text-[var(--muted)] uppercase mb-1">
            Agency Logo
          </label>
          {agencyLogoDataUri ? (
            <div className="flex items-center gap-2 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={agencyLogoDataUri}
                alt="Agency logo preview"
                className="h-10 max-w-[120px] object-contain rounded bg-[var(--bg)] border border-[var(--border)] p-1"
              />
              <button
                onClick={() => {
                  setAgencyLogoDataUri(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="font-mono text-[10px] text-[var(--muted)] uppercase underline hover:text-[var(--text)]"
              >
                Remove
              </button>
            </div>
          ) : (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="w-full mb-3 font-mono text-[10px] text-[var(--muted)]"
            />
          )}

          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] font-mono text-[11px] tracking-wide uppercase text-[var(--muted)] transition hover:text-[var(--text)]"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex-1 px-3 py-2 rounded-lg font-mono text-[11px] tracking-wide uppercase transition disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, var(--ember), var(--amber))",
                color: "#1a1614",
              }}
            >
              {exporting ? "Exporting…" : "Download PDF"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
