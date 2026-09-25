"use client";

import { useState } from "react";
import RoastReport from "./RoastReport";
import ModeToggle from "./ModeToggle";
import { sampleReport, sampleUrl } from "../lib/sample-report";
import { ReportMode } from "../lib/types";

export default function SampleReportPreview() {
  const [mode, setMode] = useState<ReportMode>("technical");

  return (
    <section
      id="sample"
      className="w-full max-w-3xl pt-24"
      aria-labelledby="sample-heading"
      data-scrape-ignore="true"
    >
      <div className="mb-8 flex flex-col items-center text-center">
        <p className="eyebrow mb-3">Example output</p>
        <h2 id="sample-heading" className="font-display text-4xl sm:text-5xl">
          A sample verdict
        </h2>
        <p className="mt-4 max-w-md leading-relaxed text-muted">
          This is what Magpie hands back — here for an example bakery,{" "}
          <span className="font-mono text-sm text-ink-soft">{sampleUrl}</span>.
        </p>
      </div>
      <RoastReport report={sampleReport} mode={mode} sample toolbar={<ModeToggle mode={mode} onChange={setMode} />} />
    </section>
  );
}
