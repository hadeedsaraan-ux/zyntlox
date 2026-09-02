"use client";

import { useEffect, useState } from "react";
import { ProgressStage } from "../lib/types";

const ICONS: Record<string, string> = {
  fetch_html: "🌐",
  microlink: "📸",
};

const GEMINI_LINES = [
  "Analyzing with Gemini…",
  "Judging your first impression…",
  "Weighing your color choices…",
  "Checking if your CTAs actually convert…",
  "Sizing up the competition…",
  "Reading between the pixels…",
  "Grading your copywriting…",
  "Deciding how brutal to be…",
];

export default function ProgressIndicator({ stage }: { stage: ProgressStage | null }) {
  const [lineIndex, setLineIndex] = useState(0);
  const isGemini = stage?.id === "gemini";

  useEffect(() => {
    if (!isGemini) return;
    const interval = setInterval(() => {
      setLineIndex((i) => (i + 1) % GEMINI_LINES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isGemini]);

  if (!stage) return null;

  const label = isGemini ? GEMINI_LINES[lineIndex] : stage.label;
  const icon = ICONS[stage.id];

  return (
    <div className="mt-4 flex items-center justify-center">
      <span
        key={isGemini ? undefined : `${stage.id}:${stage.label}`}
        className={`flex items-center gap-2 font-mono text-[13px] tracking-wide ${
          isGemini ? "gemini-shimmer" : "stage-fade text-[var(--stage-text)]"
        }`}
      >
        {icon && <span>{icon}</span>}
        <span>{label}</span>
      </span>
    </div>
  );
}
