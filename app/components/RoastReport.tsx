import type { ReactNode } from "react";
import { CheckStatus, Problem, Report, ReportMode } from "../lib/types";
import {
  LABELS,
  IMPACT_LABELS,
  EFFORT_LABELS,
  SEO_CHECK_LABELS,
  SEO_GROUP_LABELS,
  formatSeoCheckDetail,
  groupSeoChecks,
} from "../lib/labels";
import { reportUsedBackupModel } from "../lib/gemini";
import CodeSnippet from "./CodeSnippet";
import { AlertIcon, CheckIcon, CompassIcon, EyeIcon, SearchIcon } from "./Icons";

function statusDotClass(status: CheckStatus): string {
  if (status === "pass") return "bg-success";
  if (status === "warn") return "bg-warn";
  return "bg-danger";
}

function impactChipClass(impact: Problem["impact"]): string {
  if (impact === "High") return "border-danger/30 bg-danger-soft text-danger";
  if (impact === "Medium") return "border-warn/30 bg-warn-soft text-warn";
  return "";
}

const editableTextClass =
  "w-full resize-none bg-transparent border border-dashed border-line-strong/0 rounded-md -mx-2 px-2 py-1 leading-relaxed outline-none transition hover:border-line-strong focus:border-accent focus:bg-surface-2";

/** One report section: icon + serif title, colored by what the section means. */
function Section({
  icon,
  title,
  tone,
  children,
}: {
  icon: ReactNode;
  title: string;
  tone: "accent" | "danger" | "success" | "muted";
  children: ReactNode;
}) {
  const toneClass = {
    accent: "text-accent",
    danger: "text-danger",
    success: "text-success",
    muted: "text-muted",
  }[tone];
  return (
    <section className="card relative overflow-hidden p-6 sm:p-7">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] bg-current opacity-70 ${toneClass}`} />
      <h3 className="mb-4 flex items-center gap-2.5">
        <span className={toneClass}>{icon}</span>
        <span className="font-display text-2xl leading-none text-ink">{title}</span>
      </h3>
      {children}
    </section>
  );
}

export default function RoastReport({
  report,
  mode = "technical",
  sample = false,
  editable = false,
  onChange,
  toolbar,
}: {
  report: Report;
  mode?: ReportMode;
  sample?: boolean;
  editable?: boolean;
  onChange?: (updated: Report) => void;
  /** Controls shown in the sample frame's title bar (e.g. the mode toggle). */
  toolbar?: ReactNode;
}) {
  const labels = LABELS[mode];

  const content = (
    <div className="space-y-4">
      {editable && (
        <p className="text-center font-mono text-[11px] text-muted">
          Written by AI — click any passage below to correct a detail before you share it.
        </p>
      )}

      {/* First Impression */}
      <Section icon={<EyeIcon />} title={labels.firstImpression} tone="accent">
        {editable ? (
          <textarea
            className={`${editableTextClass} font-display text-[1.35rem] leading-snug text-ink`}
            value={(mode === "plain" ? report.plainFirstImpression : report.firstImpression) ?? ""}
            rows={3}
            onChange={(e) => {
              const field = mode === "plain" ? "plainFirstImpression" : "firstImpression";
              onChange?.({ ...report, [field]: e.target.value });
            }}
          />
        ) : (
          <p className="font-display text-[1.35rem] leading-snug text-ink">
            {mode === "plain" ? report.plainFirstImpression : report.firstImpression}
          </p>
        )}
        {reportUsedBackupModel(report) && (
          <p className="mt-3 font-mono text-[11px] text-muted">{labels.backupModelNotice}</p>
        )}
        {report.noScreenshot && (
          <p className="mt-3 font-mono text-[11px] text-muted">{labels.noScreenshotNotice}</p>
        )}
      </Section>

      {/* Technical SEO Checks */}
      {report.seoChecks && (
        <Section icon={<SearchIcon />} title={labels.technicalSeoChecks} tone="muted">
          {!report.seoChecks.isVerified && (
            <p className="mb-3 font-mono text-[11px] italic text-muted">{labels.seoUnverifiedNotice}</p>
          )}
          {/* Collapsed by default — the tally and issue badge in each summary signal
              what's inside without needing every group open. */}
          <div className="divide-y divide-line">
            {groupSeoChecks(report.seoChecks.checks).map(({ group, checks }) => {
              const met = checks.filter((c) => c.status === "pass").length;
              const issues = checks.filter((c) => c.status !== "pass").length;
              return (
                <details key={group} className="group py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2.5 transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      <span className="inline-block w-3 text-muted transition-transform group-open:rotate-90">›</span>
                      {SEO_GROUP_LABELS[mode][group]}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {issues > 0 && (
                        <span className="chip border-danger/30 bg-danger-soft text-danger">
                          {issues} to fix
                        </span>
                      )}
                      <span className="font-mono text-xs text-muted">
                        {met}/{checks.length}
                      </span>
                    </span>
                  </summary>
                  <div className="space-y-3 pb-3 pl-5 pt-1">
                    {checks.map((check) => (
                      <div key={check.id} className="flex gap-2.5">
                        <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${statusDotClass(check.status)}`} />
                        <div>
                          <p className="text-sm font-medium text-ink">{SEO_CHECK_LABELS[mode][check.id]}</p>
                          <p className="text-sm text-muted">{formatSeoCheckDetail(check, mode)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </Section>
      )}

      {/* Biggest Problems */}
      <Section icon={<AlertIcon />} title={labels.biggestProblems} tone="danger">
        <div className="divide-y divide-line">
          {/* An empty list only means "nice work" when the write-up actually ran —
              otherwise a failed call reads as a clean bill of health. */}
          {report.proseUnavailable ? (
            <p className="italic text-muted">{labels.proseUnavailableNotice}</p>
          ) : (
            report.biggestProblems &&
            report.biggestProblems.length === 0 && (
              <p className="text-ink-soft">No major problems found here — nice work.</p>
            )
          )}
          {report.biggestProblems?.map((p, i) => (
            <div key={i} className="flex gap-3 py-4 first:pt-0 last:pb-0">
              <span className="ring-marker mt-[7px] text-danger" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                {editable ? (
                  <textarea
                    className={`${editableTextClass} mb-1 text-ink`}
                    value={(mode === "plain" ? p.plainIssue : p.issue) ?? ""}
                    rows={2}
                    onChange={(e) => {
                      const field = mode === "plain" ? "plainIssue" : "issue";
                      onChange?.({
                        ...report,
                        biggestProblems: report.biggestProblems?.map((item, idx) =>
                          idx === i ? { ...item, [field]: e.target.value } : item
                        ),
                      });
                    }}
                  />
                ) : (
                  <p className="mb-2 leading-relaxed text-ink">{mode === "plain" ? p.plainIssue : p.issue}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <span className={`chip ${impactChipClass(p.impact)}`}>Impact · {IMPACT_LABELS[mode][p.impact]}</span>
                  <span className="chip">Effort · {EFFORT_LABELS[mode][p.effort]}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Quick Wins */}
      <Section icon={<CheckIcon />} title={labels.quickWins} tone="success">
        <ul className="space-y-4">
          {report.quickWins?.map((q, i) => (
            <li key={i} className="text-ink">
              <div className="flex gap-3">
                <span className="ring-marker mt-[7px] text-success" aria-hidden="true" />
                {editable ? (
                  <textarea
                    className={`${editableTextClass} flex-1`}
                    value={(mode === "plain" ? q.plainText : q.text) ?? ""}
                    rows={2}
                    onChange={(e) => {
                      const field = mode === "plain" ? "plainText" : "text";
                      onChange?.({
                        ...report,
                        quickWins: report.quickWins?.map((item, idx) =>
                          idx === i ? { ...item, [field]: e.target.value } : item
                        ),
                      });
                    }}
                  />
                ) : (
                  <span className="leading-relaxed">{mode === "plain" ? q.plainText : q.text}</span>
                )}
              </div>
              {q.snippet && (
                <div className="ml-6 mt-3">
                  <CodeSnippet snippet={q.snippet} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>

      {/* Suggestions */}
      <Section icon={<CompassIcon />} title={labels.suggestions} tone="accent">
        <ul className="space-y-4">
          {!report.proseUnavailable && report.suggestions && report.suggestions.length === 0 && (
            <li className="text-ink-soft">Nothing further to suggest right now.</li>
          )}
          {report.suggestions?.map((s, i) => (
            <li key={i} className="text-ink">
              <div className="flex gap-3">
                <span className="ring-marker mt-[7px] text-accent" aria-hidden="true" />
                {editable ? (
                  <textarea
                    className={`${editableTextClass} flex-1`}
                    value={(mode === "plain" ? s.plainText : s.text) ?? ""}
                    rows={2}
                    onChange={(e) => {
                      const field = mode === "plain" ? "plainText" : "text";
                      onChange?.({
                        ...report,
                        suggestions: report.suggestions?.map((item, idx) =>
                          idx === i ? { ...item, [field]: e.target.value } : item
                        ),
                      });
                    }}
                  />
                ) : (
                  <span className="leading-relaxed">{mode === "plain" ? s.plainText : s.text}</span>
                )}
              </div>
              {s.snippet && (
                <div className="ml-6 mt-3">
                  <CodeSnippet snippet={s.snippet} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );

  if (!sample) return content;

  // The sample reads as a document on the desk: a titled frame, not a live report.
  return (
    <div className="rounded-[1.4rem] border border-line bg-surface-2 p-2 sm:p-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-3 pt-1 sm:px-3">
        <span className="flex items-center gap-2">
          <span className="chip border-accent/30 text-accent">Sample</span>
          <span className="font-mono text-xs text-muted">Illustrative report</span>
        </span>
        {toolbar}
      </div>
      {content}
    </div>
  );
}
