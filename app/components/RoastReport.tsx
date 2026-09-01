import { Report, ReportMode } from "../lib/types";
import { LABELS, IMPACT_LABELS, EFFORT_LABELS } from "../lib/labels";
import ScoreGauge from "./ScoreGauge";

export default function RoastReport({
  report,
  mode = "technical",
  sample = false,
}: {
  report: Report;
  mode?: ReportMode;
  sample?: boolean;
}) {
  const labels = LABELS[mode];
  const score = report.overallScore ?? 0;

  const content = (
    <div className="space-y-5">
      <ScoreGauge score={score} />

      {/* First Impression */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--amber)] mb-2">
          👀 {labels.firstImpression}
        </h3>
        <p className="text-[var(--text)] opacity-90 leading-relaxed">
          {mode === "plain" ? report.plainFirstImpression : report.firstImpression}
        </p>
      </div>

      {/* Sub Scores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: labels.design, value: report.designScore },
          { label: labels.trust, value: report.trustScore },
          { label: labels.ux, value: report.uxScore },
          { label: labels.seo, value: report.seoScore },
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
          ❌ {labels.biggestProblems}
        </h3>
        <div className="space-y-4">
          {report.biggestProblems?.map((p, i) => (
            <div key={i} className="dotted-divider pt-4 first:pt-0 first:border-0">
              <p className="text-[var(--text)] opacity-90 mb-1">
                {mode === "plain" ? p.plainIssue : p.issue}
              </p>
              <p className="font-mono text-[11px] text-[var(--muted)] uppercase tracking-wide">
                Impact: {IMPACT_LABELS[mode][p.impact]} · Effort: {EFFORT_LABELS[mode][p.effort]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Wins */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--success)] mb-4">
          ✅ {labels.quickWins}
        </h3>
        <ul className="space-y-2">
          {(mode === "plain" ? report.plainQuickWins : report.quickWins)?.map((q, i) => (
            <li key={i} className="text-[var(--text)] opacity-90 flex gap-2">
              <span className="text-[var(--success)] font-mono">→</span> {q}
            </li>
          ))}
        </ul>
      </div>

      {/* Suggestions */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--amber)] mb-4">
          💡 {labels.suggestions}
        </h3>
        <ul className="space-y-2">
          {(mode === "plain" ? report.plainSuggestions : report.suggestions)?.map((s, i) => (
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
