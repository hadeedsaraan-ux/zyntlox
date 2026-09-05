import { CheckStatus, ComparisonReport, ComparisonWinner, ReportMode, SeoChecks, SiteSummary } from "../lib/types";
import { LABELS, SEO_CHECK_LABELS, formatSeoCheckDetail } from "../lib/labels";
import ScoreGauge from "./ScoreGauge";

function statusDotClass(status: CheckStatus): string {
  if (status === "pass") return "bg-[var(--success)]";
  if (status === "warn") return "bg-[var(--amber)]";
  return "bg-[var(--danger)]";
}

function SeoChecksColumn({
  title,
  seoChecks,
  mode,
}: {
  title: string;
  seoChecks: SeoChecks;
  mode: ReportMode;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] tracking-widest text-[var(--muted)] uppercase mb-3">
        {title}
      </p>
      <div className="space-y-3">
        {seoChecks.checks.map((check) => (
          <div key={check.id} className="flex gap-2">
            <span
              className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${statusDotClass(check.status)}`}
            />
            <div>
              <p className="text-[var(--text)] font-semibold text-sm">
                {SEO_CHECK_LABELS[mode][check.id]}
              </p>
              <p className="text-[var(--muted)] text-sm">{formatSeoCheckDetail(check, mode)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function winnerLabel(winner: ComparisonWinner) {
  if (winner === "yours") return "You win";
  if (winner === "competitor") return "Competitor wins";
  return "Tie";
}

function winnerColor(winner: ComparisonWinner) {
  if (winner === "yours") return "var(--success)";
  if (winner === "competitor") return "var(--danger)";
  return "var(--muted)";
}

function SiteCard({
  title,
  site,
  mode,
}: {
  title: string;
  site: SiteSummary;
  mode: ReportMode;
}) {
  return (
    <div className="space-y-5">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-4 py-3">
        <p className="font-mono text-[11px] tracking-widest text-[var(--muted)] uppercase mb-1">
          {title}
        </p>
        <p className="font-mono text-sm truncate">{site.url}</p>
      </div>

      <ScoreGauge score={site.overallScore ?? 0} label="Score" />

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--amber)] mb-2">
          👀 First Impression
        </h3>
        <p className="text-[var(--text)] opacity-90 leading-relaxed">
          {mode === "plain" ? site.plainFirstImpression : site.firstImpression}
        </p>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--success)] mb-4">
          ✅ Strengths
        </h3>
        <ul className="space-y-2">
          {(mode === "plain" ? site.plainStrengths : site.strengths)?.map((s, i) => (
            <li key={i} className="text-[var(--text)] opacity-90 flex gap-2">
              <span className="text-[var(--success)] font-mono">→</span> {s}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--danger)] mb-4">
          ❌ Weaknesses
        </h3>
        <ul className="space-y-2">
          {(mode === "plain" ? site.plainWeaknesses : site.weaknesses)?.map((w, i) => (
            <li key={i} className="text-[var(--text)] opacity-90 flex gap-2">
              <span className="text-[var(--danger)] font-mono">→</span> {w}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function CompetitorComparison({
  comparison,
  mode = "technical",
}: {
  comparison: ComparisonReport;
  mode?: ReportMode;
}) {
  const labels = LABELS[mode];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SiteCard title="Your Site" site={comparison.yours} mode={mode} />
        <SiteCard title="Competitor Site" site={comparison.competitor} mode={mode} />
      </div>

      {comparison.modelUsed !== "gemini-flash-latest" && (
        <p className="font-mono text-[10px] text-[var(--muted)] text-center">
          {labels.backupModelNotice}
        </p>
      )}

      {/* Overall verdict */}
      <div
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 scorched-top"
        style={{ borderColor: winnerColor(comparison.overallWinner) }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--amber)]">
            🏆 Overall Verdict
          </h3>
          <span
            className="font-mono text-[11px] tracking-widest uppercase px-2 py-1 rounded-full"
            style={{ color: winnerColor(comparison.overallWinner), border: `1px solid ${winnerColor(comparison.overallWinner)}` }}
          >
            {winnerLabel(comparison.overallWinner)}
          </span>
        </div>
        <p className="text-[var(--text)] opacity-90 leading-relaxed">
          {mode === "plain" ? comparison.plainOverallVerdict : comparison.overallVerdict}
        </p>
      </div>

      {/* Head-to-head categories */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--amber)] mb-4">
          ⚔️ Head-to-Head
        </h3>
        <div className="space-y-4">
          {comparison.categories?.map((c, i) => (
            <div key={i} className="dotted-divider pt-4 first:pt-0 first:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <span className="font-display font-bold text-sm">{c.category}</span>
                <span
                  className="font-mono text-[11px] tracking-widest uppercase"
                  style={{ color: winnerColor(c.winner) }}
                >
                  {winnerLabel(c.winner)}
                </span>
              </div>
              <p className="font-mono text-[11px] text-[var(--muted)] uppercase tracking-wide mb-1">
                You: {c.yourScore}/10 · Competitor: {c.competitorScore}/10
              </p>
              <p className="text-[var(--text)] opacity-90">
                {mode === "plain" ? c.plainVerdict : c.verdict}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Technical SEO Checks */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--muted)] mb-4">
          🔍 {labels.technicalSeoChecks}
        </h3>
        {(!comparison.yourSeoChecks.isVerified || !comparison.competitorSeoChecks.isVerified) && (
          <p className="font-mono text-[10px] text-[var(--muted)] italic mb-4">
            {labels.seoUnverifiedNotice}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SeoChecksColumn title="Your Site" seoChecks={comparison.yourSeoChecks} mode={mode} />
          <SeoChecksColumn
            title="Competitor Site"
            seoChecks={comparison.competitorSeoChecks}
            mode={mode}
          />
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6">
        <h3 className="font-display font-bold text-sm tracking-wide uppercase text-[var(--amber)] mb-4">
          💡 How to Beat Them
        </h3>
        <ul className="space-y-2">
          {(mode === "plain" ? comparison.plainTopRecommendations : comparison.topRecommendations)?.map(
            (r, i) => (
              <li key={i} className="text-[var(--text)] opacity-90 flex gap-2">
                <span className="text-[var(--amber)] font-mono">→</span> {r}
              </li>
            )
          )}
        </ul>
      </div>
    </div>
  );
}
