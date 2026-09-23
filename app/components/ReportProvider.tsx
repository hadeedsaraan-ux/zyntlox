"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { Report, ReportMode } from "../lib/types";

const ReportContext = createContext<{
  report: Report | null;
  setReport: (report: Report | null) => void;
  mode: ReportMode;
  setMode: (mode: ReportMode) => void;
  reportUrl: string;
  setReportUrl: (url: string) => void;
  agencyName: string;
  setAgencyName: (name: string) => void;
  agencyLogoDataUri: string | null;
  setAgencyLogoDataUri: (dataUri: string | null) => void;
} | null>(null);

export function ReportProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<Report | null>(null);
  const [mode, setMode] = useState<ReportMode>("technical");
  const [reportUrl, setReportUrl] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [agencyLogoDataUri, setAgencyLogoDataUri] = useState<string | null>(null);

  return (
    <ReportContext.Provider
      value={{
        report,
        setReport,
        mode,
        setMode,
        reportUrl,
        setReportUrl,
        agencyName,
        setAgencyName,
        agencyLogoDataUri,
        setAgencyLogoDataUri,
      }}
    >
      {children}
    </ReportContext.Provider>
  );
}

export function useReport() {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error("useReport must be used within a ReportProvider");
  return ctx;
}
