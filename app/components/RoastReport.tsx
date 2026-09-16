import { CheckStatus, Report, ReportMode } from "../lib/types";
import {
  LABELS,
  IMPACT_LABELS,
  EFFORT_LABELS,
  SEO_CHECK_LABELS,
  SEO_GROUP_LABELS,
  formatSeoCheckDetail,
  groupSeoChecks,
} from "../lib/labels";
import { usedBackupModel } from "../lib/gemini";
import ScoreGauge from "./ScoreGauge";
import CodeSnippet from "./CodeSnippet";

function statusDotClass(status: CheckStatus): string {
  if (status === "pass") return "bg-[var(--success)]";
  if (status === "warn") return "bg-[var(--amber)]";
  return "bg-[var(--danger)]";
}

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
        {usedBackupModel(report.modelUsed) && (
          <p className="font-mono text-[10px] text-[var(--muted)] mt-2">
            {labels.backupModelNotice}
          </p>
        )}
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

      {/* Technical SEO Checks */}
      {report.seoChecks && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
          <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--muted)] mb-4">
            🔍 {labels.technicalSeoChecks}
          </h3>
          {!report.seoChecks.isVerified && (
            <p className="font-mono text-[10px] text-[var(--muted)] italic mb-3">
              {labels.seoUnverifiedNotice}
            </p>
          )}
          {/* Same collapsed-by-default <details> treatment as the Design/Trust/UX
              breakdown above, for consistency now that this section also groups its
              checks — the tally and issue badge in the summary signal what's inside
              without needing every group open by default. */}
          <div className="space-y-2">
            {groupSeoChecks(report.seoChecks.checks).map(({ group, checks }) => {
              const met = checks.filter((c) => c.status === "pass").length;
              const issues = checks.filter((c) => c.status !== "pass").length;
              return (
                <details
                  key={group}
                  className="group border-b border-[var(--border)] last:border-0 pb-2"
                >
                  <summary className="flex items-baseline justify-between gap-2 cursor-pointer list-none py-1 hover:text-[var(--amber)] transition-colors">
                    <span className="text-[var(--text)] text-sm font-semibold">
                      <span className="inline-block w-3 text-[var(--muted)] group-open:rotate-90 transition-transform">
                        ›
                      </span>
                      {SEO_GROUP_LABELS[mode][group]}
                    </span>
                    <span className="flex items-baseline gap-1.5 shrink-0">
                      {issues > 0 && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--danger)]/15 text-[var(--danger)]">
                          {issues}
                        </span>
                      )}
                      <span className="font-mono text-xs text-[var(--muted)]">
                        {met}/{checks.length}
                      </span>
                    </span>
                  </summary>
                  <div className="space-y-3 pl-3 pt-1">
                    {checks.map((check) => (
                      <div key={check.id} className="flex gap-2">
                        <span
                          className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${statusDotClass(check.status)}`}
                        />
                        <div>
                          <p className="text-[var(--text)] font-semibold text-sm">
                            {SEO_CHECK_LABELS[mode][check.id]}
                          </p>
                          <p className="text-[var(--muted)] text-sm">
                            {formatSeoCheckDetail(check, mode)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

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
        <ul className="space-y-3">
          {report.quickWins?.map((q, i) => (
            <li key={i} className="text-[var(--text)] opacity-90">
              <div className="flex gap-2">
                <span className="text-[var(--success)] font-mono shrink-0">→</span>
                <span>{mode === "plain" ? q.plainText : q.text}</span>
              </div>
              {q.snippet && (
                <div className="mt-2 ml-5">
                  <CodeSnippet snippet={q.snippet} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Suggestions */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--amber)] mb-4">
          💡 {labels.suggestions}
        </h3>
        <ul className="space-y-3">
          {report.suggestions?.map((s, i) => (
            <li key={i} className="text-[var(--text)] opacity-90">
              <div className="flex gap-2">
                <span className="text-[var(--amber)] font-mono shrink-0">→</span>
                <span>{mode === "plain" ? s.plainText : s.text}</span>
              </div>
              {s.snippet && (
                <div className="mt-2 ml-5">
                  <CodeSnippet snippet={s.snippet} />
                </div>
              )}
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
