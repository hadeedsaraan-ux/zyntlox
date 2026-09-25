export default function ScoreGauge({
  score,
  label = "Overall score",
}: {
  score: number;
  label?: string;
}) {
  const gaugeAngle = (score / 100) * 180;
  const gaugeColor = score >= 70 ? "var(--success)" : score >= 40 ? "var(--warn)" : "var(--danger)";

  return (
    <div className="card flex flex-col items-center p-7">
      <span className="eyebrow mb-4">{label}</span>
      <svg width="180" height="100" viewBox="0 0 180 100" aria-hidden="true">
        <path
          d="M 10 90 A 80 80 0 0 1 170 90"
          fill="none"
          stroke="var(--line)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 10 90 A 80 80 0 0 1 170 90"
          fill="none"
          stroke={gaugeColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray="251.2"
          strokeDashoffset={251.2 - (251.2 * gaugeAngle) / 180}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <span className="-mt-5 font-display text-5xl" style={{ color: gaugeColor }}>
        {score}
        <span className="font-mono text-base text-muted">/100</span>
      </span>
    </div>
  );
}
