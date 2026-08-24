const steps = [
  { number: "01", title: "Paste URL", description: "Drop in the link to any website you want feedback on." },
  { number: "02", title: "AI Analyzes", description: "We scan the page and screenshot it, then hand it to AI for review." },
  { number: "03", title: "Get Report", description: "Receive a scored, actionable breakdown in under 60 seconds." },
];

export default function HowItWorks() {
  return (
    <section className="w-full max-w-2xl mt-12">
      <div className="text-center mb-6">
        <span className="font-mono text-[11px] tracking-widest text-[var(--muted)] uppercase">
          The Process
        </span>
        <h2 className="font-display text-2xl font-bold mt-2">How It Works</h2>
      </div>
      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {steps.map((step) => (
          <li
            key={step.number}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center"
          >
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-full font-mono text-xs font-bold mb-3"
              style={{
                background: "linear-gradient(135deg, var(--ember), var(--amber))",
                color: "#1a1614",
              }}
            >
              {step.number}
            </span>
            <p className="font-display font-bold mb-1">{step.title}</p>
            <p className="text-[var(--muted)] text-sm leading-relaxed">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
