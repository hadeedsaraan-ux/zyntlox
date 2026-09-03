"use client";

import { useEffect, useState } from "react";
import { ProgressStage } from "../lib/types";

const ICONS: Record<string, string> = {
  fetch_html: "🌐",
  microlink: "📸",
};

// GEMINI_LINES[0] is the intro line — shown once per gemini stage, then never repeated.
const GEMINI_LINES = [
  "Analyzing with Gemini…",
  "Judging your first impression…",
  "Weighing your color choices…",
  "Checking if your CTAs actually convert…",
  "Sizing up the competition…",
  "Reading between the pixels…",
  "Grading your copywriting…",
  "Deciding how brutal to be…",
  "Counting your broken links…",
  "Squinting at your font choices…",
  "Timing how long your hero section takes to make sense…",
  "Hunting for missing alt text…",
  "Judging that stock photo…",
  "Checking if anyone can actually find your pricing…",
  "Testing your buttons for main character energy…",
  "Measuring the awkward silence in your whitespace…",
  "Fact-checking your trust badges…",
  "Wondering who approved that shade of orange…",
  "Scanning your headlines for actual meaning…",
  "Counting how many clicks to checkout…",
  "Sniffing out corporate jargon…",
  "Checking if your footer knows what year it is…",
  "Rating your navigation menu's life choices…",
  "Looking for a reason to trust you…",
  "Comparing your site to something built in 2009…",
  "Assessing your mobile layout's will to live…",
  "Double-checking that testimonial isn't fake…",
  "Estimating how fast your visitors bounce…",
  "Cross-examining your value proposition…",
  "Checking if your logo is doing any work at all…",
  "Reading your About page so you don't have to…",
  "Judging your form fields for excessive ambition…",
  "Looking for the 'buy now' button you buried…",
  "Weighing the vibes versus the substance…",
  "Checking your HTTPS like it's 2025…",
  "Timing your load speed with a stopwatch…",
  "Deciding if that pop-up was really necessary…",
  "Scoring your SEO homework…",
  "Peeking under the hood at your meta description…",
  "Rating your headline's confidence level…",
  "Checking if your site looks good or just loud…",
  "Comparing promises made versus promises kept…",
  "Auditing your button copy for personality…",
  "Looking for a single reason to scroll further…",
  "Checking if your contact page actually contacts anyone…",
  "Grading your visual hierarchy…",
  "Sniffing out placeholder text you forgot to replace…",
  "Weighing first impressions against reality…",
  "Preparing some brutally honest notes…",
  "Finalizing the verdict…",
];

const INTRO_DURATION_MS = 5000;
const CYCLE_DURATION_MS = 4000;

export default function ProgressIndicator({ stage }: { stage: ProgressStage | null }) {
  const [lineIndex, setLineIndex] = useState(0);
  const isGemini = stage?.id === "gemini";

  useEffect(() => {
    if (!isGemini) return;

    // Reset to the intro line each time we (re-)enter the gemini stage.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when entering a new gemini phase
    setLineIndex(0);

    const rest = GEMINI_LINES.length - 1;
    let current = 0;
    let timer: ReturnType<typeof setTimeout>;

    const scheduleNext = (delay: number) => {
      timer = setTimeout(() => {
        current = (current % rest) + 1; // cycles 1..rest, skipping the intro
        setLineIndex(current);
        scheduleNext(CYCLE_DURATION_MS);
      }, delay);
    };
    scheduleNext(INTRO_DURATION_MS);

    return () => clearTimeout(timer);
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
