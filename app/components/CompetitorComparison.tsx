import { CheckStatus, ComparisonReport, ComparisonWinner, ReportMode, SeoChecks, SiteSummary } from "../lib/types";
import { LABELS, SEO_CHECK_LABELS, formatSeoCheckDetail } from "../lib/labels";
import { usedBackupModel } from "../lib/gemini";
import ScoreGauge from "./ScoreGauge";

function statusDotClass(status: CheckStatus): string {
  if (status === "pass") return "bg-success";
  if (status === "warn") return "bg-warn";
  return "bg-danger";
}

function Card({ title, tone = "text-accent", children }: { title: string; tone?: string; children: React.ReactNode }) {
  return (
    <section className="card relative overflow-hidden p-6">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] bg-current opacity-70 ${tone}`} />
      <h3 className="mb-4 font-display text-2xl leading-none text-ink">{title}</h3>
      {children}
    </section>
  );
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
      <p className="eyebrow mb-3">{title}</p>
      <div className="space-y-3">
        {seoChecks.checks.map((check) => (
          <div key={check.id} className="flex gap-2">
            <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${statusDotClass(check.status)}`} />
            <div>
              <p className="text-sm font-medium text-ink">{SEO_CHECK_LABELS[mode][check.id]}</p>
              <p className="text-sm text-muted">{formatSeoCheckDetail(check, mode)}</p>
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
    <div className="space-y-4">
      <div className="card px-5 py-4">
        <p className="eyebrow mb-1">{title}</p>
        <p className="truncate font-mono text-sm text-ink">{site.url}</p>
      </div>

      <ScoreGauge score={site.overallScore ?? 0} label="Score" />

      <Card title="First impression">
        <p className="font-display text-xl leading-snug text-ink">
          {mode === "plain" ? site.plainFirstImpression : site.firstImpression}
        </p>
      </Card>

      <Card title="Strengths" tone="text-success">
        <ul className="space-y-3">
          {(mode === "plain" ? site.plainStrengths : site.strengths)?.map((s, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-ink">
              <span className="ring-marker mt-[7px] text-success" aria-hidden="true" /> {s}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Weaknesses" tone="text-danger">
        <ul className="space-y-3">
          {(mode === "plain" ? site.plainWeaknesses : site.weaknesses)?.map((w, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-ink">
              <span className="ring-marker mt-[7px] text-danger" aria-hidden="true" /> {w}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function winnerChipClass(winner: ComparisonWinner) {
  if (winner === "yours") return "border-success/30 bg-success-soft text-success";
  if (winner === "competitor") return "border-danger/30 bg-danger-soft text-danger";
  return "";
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
    <div className="space-y-4">
      {/* Overall verdict first — it's the answer people came for. */}
      <section className="card relative overflow-hidden p-6 sm:p-8">
        <span aria-hidden="true" className="sheen-bg absolute inset-x-0 top-0 h-[3px]" />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Overall verdict</p>
          <span className={`chip ${winnerChipClass(comparison.overallWinner)}`}>
            {winnerLabel(comparison.overallWinner)}
          </span>
        </div>
        <p className="font-display text-2xl leading-snug text-ink sm:text-[1.7rem]">
          {mode === "plain" ? comparison.plainOverallVerdict : comparison.overallVerdict}
        </p>
      </section>

      {usedBackupModel(comparison.modelUsed) && (
        <p className="text-center font-mono text-[11px] text-muted">{labels.backupModelNotice}</p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SiteCard title="Your site" site={comparison.yours} mode={mode} />
        <SiteCard title="Competitor" site={comparison.competitor} mode={mode} />
      </div>

      <Card title="Head-to-head">
        <div className="divide-y divide-line">
          {comparison.categories?.map((c, i) => (
            <div key={i} className="py-4 first:pt-0 last:pb-0">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink">{c.category}</span>
                <span className={`chip ${winnerChipClass(c.winner)}`}>{winnerLabel(c.winner)}</span>
              </div>
              <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted">
                You {c.yourScore}/10 · Competitor {c.competitorScore}/10
              </p>
              <p className="leading-relaxed text-ink-soft">{mode === "plain" ? c.plainVerdict : c.verdict}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title={labels.technicalSeoChecks} tone="text-muted">
        {(!comparison.yourSeoChecks.isVerified || !comparison.competitorSeoChecks.isVerified) && (
          <p className="mb-4 font-mono text-[11px] italic text-muted">{labels.seoUnverifiedNotice}</p>
        )}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SeoChecksColumn title="Your site" seoChecks={comparison.yourSeoChecks} mode={mode} />
          <SeoChecksColumn title="Competitor" seoChecks={comparison.competitorSeoChecks} mode={mode} />
        </div>
      </Card>

      <Card title="How to pull ahead">
        <ol className="space-y-3">
          {(mode === "plain" ? comparison.plainTopRecommendations : comparison.topRecommendations)?.map((r, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-ink">
              <span className="mt-0.5 font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
              {r}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
