"use client";

import { useState } from "react";
import RoastReport from "./RoastReport";
import ModeToggle from "./ModeToggle";
import { sampleReport, sampleUrl } from "../lib/sample-report";
import { ReportMode } from "../lib/types";

export default function SampleReportPreview() {
  const [mode, setMode] = useState<ReportMode>("technical");

  return (
    <section className="w-full max-w-2xl mt-12">
      <div className="text-center mb-6">
        <span className="font-mono text-[11px] tracking-widest text-[var(--amber)] uppercase">
          ▸ Example Output ◂
        </span>
        <h2 className="font-display text-2xl font-bold mt-2 mb-2">
          See a Sample Report
        </h2>
        <p className="text-[var(--muted)] max-w-md mx-auto leading-relaxed">
          Here's what a real roast looks like — this one's for{" "}
          <span className="font-mono">{sampleUrl}</span>.
        </p>
      </div>
      <div className="flex justify-center mb-4">
        <ModeToggle mode={mode} onChange={setMode} />
      </div>
      <RoastReport report={sampleReport} mode={mode} sample />
    </section>
  );
}
