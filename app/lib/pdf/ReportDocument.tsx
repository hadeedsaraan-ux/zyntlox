import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { CheckStatus, Report, ReportMode } from "../types";
import { LABELS, IMPACT_LABELS, EFFORT_LABELS, SEO_CHECK_LABELS, formatSeoCheckDetail } from "../labels";

const COLORS = {
  bg: "#1a1614",
  bgCard: "#211c19",
  ember: "#ff6b35",
  amber: "#ffa940",
  text: "#f5efe6",
  muted: "#9c8f82",
  border: "#342c26",
  danger: "#e5484d",
  success: "#7cb87f",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    paddingTop: 32,
    paddingLeft: 32,
    paddingRight: 32,
    paddingBottom: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 16,
  },
  wordmark: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: COLORS.text,
    letterSpacing: 1,
  },
  meta: {
    fontSize: 9,
    color: COLORS.muted,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: COLORS.text,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scoreValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 28,
  },
  scoreBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    marginTop: 10,
  },
  scoreBarFill: {
    height: 8,
    borderRadius: 4,
  },
  subScoreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  subScoreCard: {
    flexBasis: "23%",
    flexGrow: 1,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  subScoreLabel: {
    fontSize: 8,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: COLORS.muted,
    marginBottom: 4,
    textAlign: "center",
  },
  subScoreValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
  },
  seoCheckRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  seoCheckDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 3,
    marginRight: 8,
  },
  seoCheckLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  seoCheckDetail: {
    fontSize: 9,
    color: COLORS.muted,
    marginTop: 1,
  },
  noticeBanner: {
    fontSize: 8,
    color: COLORS.muted,
    marginBottom: 8,
    fontStyle: "italic",
  },
  problemRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderTopStyle: "dashed",
    paddingTop: 8,
    marginTop: 8,
  },
  problemRowFirst: {
    paddingTop: 0,
    marginTop: 0,
    borderTopWidth: 0,
  },
  problemMeta: {
    fontSize: 8,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: COLORS.muted,
    marginTop: 3,
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 5,
  },
  listArrow: {
    width: 12,
    fontFamily: "Helvetica-Bold",
  },
  listText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.5,
  },
  codeBlock: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 8,
    marginTop: 4,
    marginLeft: 12,
  },
  codeLanguage: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: COLORS.muted,
    marginBottom: 4,
  },
  codeText: {
    fontFamily: "Courier",
    fontSize: 8,
    lineHeight: 1.4,
    color: COLORS.text,
    wordBreak: "break-all",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerTextLeft: {
    fontSize: 8,
    color: COLORS.muted,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  footerTextRight: {
    fontSize: 8,
    color: COLORS.muted,
  },
});

function cleanPdfText(str?: string | null): string {
  if (!str) return "";
  return (
    str
      // Convert literal sequence \n into actual newline
      .replace(/\\n/g, "\n")
      // Normalize line endings
      .replace(/\r\n/g, "\n")
      // Replace smart double quotes
      .replace(/[“”]/g, '"')
      // Replace smart single quotes
      .replace(/[‘’]/g, "'")
      // Replace em dash & en dash
      .replace(/[—–]/g, "-")
      // Replace non-breaking spaces
      .replace(/\u00A0/g, " ")
      // Replace bullets
      .replace(/•/g, "*")
      // Strip unsupported emojis/symbols outside WinAnsi
      .replace(
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1F004}\u{1F0CF}]/gu,
        ""
      )
      // Remove unprintable control characters except newline
      .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "")
  );
}

function scoreColor(score: number) {
  if (score >= 70) return COLORS.success;
  if (score >= 40) return COLORS.amber;
  return COLORS.ember;
}

function statusColor(status: CheckStatus) {
  if (status === "pass") return COLORS.success;
  if (status === "warn") return COLORS.amber;
  return COLORS.danger;
}

export default function ReportDocument({
  report,
  mode,
  url,
}: {
  report: Report;
  mode: ReportMode;
  url: string;
}) {
  const labels = LABELS[mode];
  const score = report.overallScore ?? 0;
  const gaugeColor = scoreColor(score);
  const generatedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Document title={`Zyntlox Report - ${cleanPdfText(url)}`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.wordmark}>ZYNTLOX</Text>
          <Text style={styles.meta}>{cleanPdfText(url)}</Text>
          <Text style={styles.meta}>
            Generated {generatedAt} · {mode === "plain" ? "Plain English" : "Technical"} mode
          </Text>
          {report.modelUsed !== "gemini-flash-latest" && (
            <Text style={styles.meta}>{labels.backupModelNotice}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { color: COLORS.muted }]}>
            Overall Score
          </Text>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreValue, { color: gaugeColor }]}>
              {score}
              <Text style={{ fontSize: 12, color: COLORS.muted }}>/100</Text>
            </Text>
          </View>
          <View style={styles.scoreBarTrack}>
            <View
              style={[
                styles.scoreBarFill,
                { width: `${Math.max(0, Math.min(100, score))}%`, backgroundColor: gaugeColor },
              ]}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { color: COLORS.amber }]}>
            {labels.firstImpression}
          </Text>
          <Text style={styles.bodyText}>
            {cleanPdfText(mode === "plain" ? report.plainFirstImpression : report.firstImpression)}
          </Text>
        </View>

        <View style={styles.subScoreGrid}>
          {[
            { label: labels.design, value: report.designScore },
            { label: labels.trust, value: report.trustScore },
            { label: labels.ux, value: report.uxScore },
            { label: labels.seo, value: report.seoScore },
          ].map((s) => (
            <View key={s.label} style={styles.subScoreCard}>
              <Text style={styles.subScoreLabel}>{s.label}</Text>
              <Text style={styles.subScoreValue}>
                {s.value}
                <Text style={{ fontSize: 9, color: COLORS.muted }}>/10</Text>
              </Text>
            </View>
          ))}
        </View>

        {report.seoChecks && (
          <View style={styles.card} wrap={false}>
            <Text style={[styles.sectionTitle, { color: COLORS.muted }]}>
              {labels.technicalSeoChecks}
            </Text>
            {!report.seoChecks.isVerified && (
              <Text style={styles.noticeBanner}>{labels.seoUnverifiedNotice}</Text>
            )}
            {report.seoChecks.checks.map((check) => (
              <View key={check.id} style={styles.seoCheckRow}>
                <View
                  style={[styles.seoCheckDot, { backgroundColor: statusColor(check.status) }]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.seoCheckLabel}>{SEO_CHECK_LABELS[mode][check.id]}</Text>
                  <Text style={styles.seoCheckDetail}>
                    {formatSeoCheckDetail(check, mode)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {report.biggestProblems && report.biggestProblems.length > 0 && (
          <View style={styles.card} wrap>
            {report.biggestProblems.map((p, i) => {
              const itemContent = (
                <View
                  style={i === 0 ? styles.problemRowFirst : styles.problemRow}
                >
                  <Text style={styles.bodyText}>
                    {cleanPdfText(mode === "plain" ? p.plainIssue : p.issue)}
                  </Text>
                  <Text style={styles.problemMeta}>
                    Impact: {IMPACT_LABELS[mode][p.impact]} · Effort: {EFFORT_LABELS[mode][p.effort]}
                  </Text>
                </View>
              );

              if (i === 0) {
                return (
                  <View key={i} wrap={false}>
                    <Text style={[styles.sectionTitle, { color: COLORS.danger }]}>
                      {labels.biggestProblems}
                    </Text>
                    {itemContent}
                  </View>
                );
              }

              return (
                <View key={i} wrap={false}>
                  {itemContent}
                </View>
              );
            })}
          </View>
        )}

        {report.quickWins && report.quickWins.length > 0 && (
          <View style={styles.card} wrap>
            {report.quickWins.map((q, i) => {
              const itemContent = (
                <View style={i > 0 ? { marginTop: 8 } : undefined}>
                  <View style={styles.listItem}>
                    <Text style={[styles.listArrow, { color: COLORS.success }]}>&gt;</Text>
                    <Text style={styles.listText}>
                      {cleanPdfText(mode === "plain" ? q.plainText : q.text)}
                    </Text>
                  </View>
                  {q.snippet && (
                    <View style={styles.codeBlock}>
                      <Text style={styles.codeLanguage}>
                        {cleanPdfText(q.snippet.language)}
                      </Text>
                      <Text style={styles.codeText}>
                        {cleanPdfText(q.snippet.code)}
                      </Text>
                    </View>
                  )}
                </View>
              );

              if (i === 0) {
                return (
                  <View key={i} wrap={false}>
                    <Text style={[styles.sectionTitle, { color: COLORS.success }]}>
                      {labels.quickWins}
                    </Text>
                    {itemContent}
                  </View>
                );
              }

              return (
                <View key={i} wrap={false}>
                  {itemContent}
                </View>
              );
            })}
          </View>
        )}

        {report.suggestions && report.suggestions.length > 0 && (
          <View style={styles.card} wrap>
            {report.suggestions.map((s, i) => {
              const itemContent = (
                <View style={i > 0 ? { marginTop: 8 } : undefined}>
                  <View style={styles.listItem}>
                    <Text style={[styles.listArrow, { color: COLORS.amber }]}>&gt;</Text>
                    <Text style={styles.listText}>
                      {cleanPdfText(mode === "plain" ? s.plainText : s.text)}
                    </Text>
                  </View>
                  {s.snippet && (
                    <View style={styles.codeBlock}>
                      <Text style={styles.codeLanguage}>
                        {cleanPdfText(s.snippet.language)}
                      </Text>
                      <Text style={styles.codeText}>
                        {cleanPdfText(s.snippet.code)}
                      </Text>
                    </View>
                  )}
                </View>
              );

              if (i === 0) {
                return (
                  <View key={i} wrap={false}>
                    <Text style={[styles.sectionTitle, { color: COLORS.amber }]}>
                      {labels.suggestions}
                    </Text>
                    {itemContent}
                  </View>
                );
              }

              return (
                <View key={i} wrap={false}>
                  {itemContent}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerTextLeft}>ZYNTLOX REPORT</Text>
          <Text
            style={styles.footerTextRight}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
