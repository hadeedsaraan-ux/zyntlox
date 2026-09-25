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
        : "magpie-report";

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
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`btn-ghost px-3 py-1.5 text-xs ${error ? "border-danger/50 text-danger" : ""}`}
      >
        {error ? "Export failed — retry" : "Export PDF"}
      </button>

      {open && (
        <div className="card absolute right-0 top-[calc(100%+8px)] z-30 w-[min(20rem,calc(100vw-2rem))] p-4">
          <p className="eyebrow mb-3">Brand this PDF · optional</p>

          <label htmlFor="agency-name" className="mb-1 block text-xs font-medium text-ink-soft">
            Agency name
          </label>
          <input
            id="agency-name"
            type="text"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            placeholder="Defaults to Magpie"
            className="field mb-3 px-3 py-2 text-sm"
          />

          <label className="mb-1 block text-xs font-medium text-ink-soft">Agency logo</label>
          {agencyLogoDataUri ? (
            <div className="mb-3 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={agencyLogoDataUri}
                alt="Agency logo preview"
                className="h-10 max-w-[120px] rounded border border-line bg-surface-2 object-contain p-1"
              />
              <button
                type="button"
                onClick={() => {
                  setAgencyLogoDataUri(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-xs text-muted underline hover:text-ink"
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
              className="mb-3 w-full text-xs text-muted file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-surface-2 file:px-2.5 file:py-1 file:text-xs file:text-ink"
            />
          )}

          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost flex-1 px-3 py-2 text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="btn-primary flex-1 px-3 py-2 text-sm"
            >
              {exporting ? "Exporting…" : "Download PDF"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
