export default function ScoreGauge({
  score,
  label = "Overall Score",
}: {
  score: number;
  label?: string;
}) {
  const gaugeAngle = (score / 100) * 180;
  const gaugeColor =
    score >= 70 ? "#7cb87f" : score >= 40 ? "#ffa940" : "#ff6b35";

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-8 flex flex-col items-center scorched-top">
      <span className="font-mono text-[11px] tracking-widest text-[var(--muted)] uppercase mb-4">
        {label}
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
  );
}
