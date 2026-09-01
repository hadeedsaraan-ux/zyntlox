import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { Report, ReportMode } from "../types";
import { LABELS, IMPACT_LABELS, EFFORT_LABELS } from "../labels";

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
    padding: 32,
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
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: COLORS.muted,
  },
});

function scoreColor(score: number) {
  if (score >= 70) return COLORS.success;
  if (score >= 40) return COLORS.amber;
  return COLORS.ember;
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
    <Document title={`Zyntlox Report - ${url}`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.wordmark}>ZYNTLOX</Text>
          <Text style={styles.meta}>{url}</Text>
          <Text style={styles.meta}>
            Generated {generatedAt} · {mode === "plain" ? "Plain English" : "Technical"} mode
          </Text>
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
            {mode === "plain" ? report.plainFirstImpression : report.firstImpression}
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

        <View style={styles.card} wrap>
          <Text style={[styles.sectionTitle, { color: COLORS.danger }]}>
            {labels.biggestProblems}
          </Text>
          {report.biggestProblems?.map((p, i) => (
            <View
              key={i}
              style={i === 0 ? styles.problemRowFirst : styles.problemRow}
              wrap={false}
            >
              <Text style={styles.bodyText}>
                {mode === "plain" ? p.plainIssue : p.issue}
              </Text>
              <Text style={styles.problemMeta}>
                Impact: {IMPACT_LABELS[mode][p.impact]} · Effort: {EFFORT_LABELS[mode][p.effort]}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.card} wrap>
          <Text style={[styles.sectionTitle, { color: COLORS.success }]}>
            {labels.quickWins}
          </Text>
          {(mode === "plain" ? report.plainQuickWins : report.quickWins)?.map((q, i) => (
            <View key={i} style={styles.listItem} wrap={false}>
              <Text style={[styles.listArrow, { color: COLORS.success }]}>{"→"}</Text>
              <Text style={styles.listText}>{q}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card} wrap>
          <Text style={[styles.sectionTitle, { color: COLORS.amber }]}>
            {labels.suggestions}
          </Text>
          {(mode === "plain" ? report.plainSuggestions : report.suggestions)?.map((s, i) => (
            <View key={i} style={styles.listItem} wrap={false}>
              <Text style={[styles.listArrow, { color: COLORS.amber }]}>{"→"}</Text>
              <Text style={styles.listText}>{s}</Text>
            </View>
          ))}
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `Generated by zyntlox · Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
