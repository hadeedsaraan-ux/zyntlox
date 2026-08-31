import { ReportMode } from "../lib/types";

export default function ModeToggle({
  mode,
  onChange,
}: {
  mode: ReportMode;
  onChange: (mode: ReportMode) => void;
}) {
  const options: { value: ReportMode; label: string }[] = [
    { value: "technical", label: "Technical" },
    { value: "plain", label: "Plain English" },
  ];

  return (
    <div className="inline-flex p-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg">
      {options.map((opt) => {
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="px-4 py-1.5 rounded-md font-mono text-xs tracking-wide uppercase transition"
            style={
              active
                ? {
                    background: "linear-gradient(135deg, var(--ember), var(--amber))",
                    color: "#1a1614",
                  }
                : { color: "var(--muted)" }
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
