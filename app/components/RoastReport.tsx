import { Report } from "../lib/types";

export default function RoastReport({
  report,
  sample = false,
}: {
  report: Report;
  sample?: boolean;
}) {
  const score = report.overallScore ?? 0;
  const gaugeAngle = (score / 100) * 180;
  const gaugeColor =
    score >= 70 ? "#7cb87f" : score >= 40 ? "#ffa940" : "#ff6b35";

  const content = (
    <div className="space-y-5">
      {/* Heat Gauge */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 flex flex-col items-center scorched-top">
        <span className="font-mono text-[11px] tracking-widest text-[var(--muted)] uppercase mb-4">
          Overall Score
        </span>
        <svg width="180" height="100" viewBox="0 0 180 100">
          <path
            d="M 10 90 A 80 80 0 0 1 170 90"
            fill="none"
            stroke="var(--border)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M 10 90 A 80 80 0 0 1 170 90"
            fill="none"
            stroke={gaugeColor}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="251.2"
            strokeDashoffset={251.2 - (251.2 * gaugeAngle) / 180}
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </svg>
        <span className="font-mono text-4xl font-bold -mt-4" style={{ color: gaugeColor }}>
          {score}
          <span className="text-lg text-[var(--muted)]">/100</span>
        </span>
      </div>

      {/* First Impression */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--amber)] mb-2">
          👀 First Impression
        </h3>
        <p className="text-[var(--text)] opacity-90 leading-relaxed">
          {report.firstImpression}
        </p>
      </div>

      {/* Sub Scores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Design", value: report.designScore },
          { label: "Trust", value: report.trustScore },
          { label: "UX", value: report.uxScore },
          { label: "SEO", value: report.seoScore },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center"
          >
            <p className="font-mono text-[10px] tracking-widest text-[var(--muted)] uppercase mb-1">
              {s.label}
            </p>
            <p className="font-mono text-2xl font-bold">
              {s.value}
              <span className="text-sm text-[var(--muted)]">/10</span>
            </p>
          </div>
        ))}
      </div>

      {/* Biggest Problems */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--danger)] mb-4">
          ❌ Biggest Problems
        </h3>
        <div className="space-y-4">
          {report.biggestProblems?.map((p, i) => (
            <div key={i} className="dotted-divider pt-4 first:pt-0 first:border-0">
              <p className="text-[var(--text)] opacity-90 mb-1">{p.issue}</p>
              <p className="font-mono text-[11px] text-[var(--muted)] uppercase tracking-wide">
                Impact: {p.impact} · Effort: {p.effort}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Wins */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--success)] mb-4">
          ✅ Quick Wins
        </h3>
        <ul className="space-y-2">
          {report.quickWins?.map((q, i) => (
            <li key={i} className="text-[var(--text)] opacity-90 flex gap-2">
              <span className="text-[var(--success)] font-mono">→</span> {q}
            </li>
          ))}
        </ul>
      </div>

      {/* Suggestions */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--amber)] mb-4">
          💡 AI Suggestions
        </h3>
        <ul className="space-y-2">
          {report.suggestions?.map((s, i) => (
            <li key={i} className="text-[var(--text)] opacity-90 flex gap-2">
              <span className="text-[var(--amber)] font-mono">→</span> {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  if (!sample) return content;

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-[var(--amber)] p-4 sm:p-6">
      <div
        className="absolute z-10 top-[22px] right-[-58px] w-[220px] rotate-45 py-1.5 text-center font-mono text-[11px] font-bold tracking-widest uppercase shadow-md"
        style={{
          background: "linear-gradient(135deg, var(--ember), var(--amber))",
          color: "#1a1614",
        }}
      >
        Sample
      </div>
      {content}
    </div>
  );
}
