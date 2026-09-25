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
    <div role="group" aria-label="Report wording" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {options.map((opt) => {
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              active ? "bg-ink text-on-ink" : "text-muted hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
