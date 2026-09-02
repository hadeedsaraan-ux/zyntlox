"use client";

import { ProgressStage } from "../lib/types";

const ICONS: Record<string, string> = {
  fetch_html: "🌐",
  microlink: "📸",
  gemini: "✨",
};

export default function ProgressIndicator({ stage }: { stage: ProgressStage | null }) {
  if (!stage) return null;

  return (
    <div className="mt-4 flex items-center justify-center">
      <span
        key={`${stage.id}:${stage.label}`}
        className="stage-fade flex items-center gap-2 font-mono text-[13px] tracking-wide text-[var(--stage-text)]"
      >
        <span>{ICONS[stage.id] ?? "⚙️"}</span>
        <span>{stage.label}</span>
      </span>
    </div>
  );
}
