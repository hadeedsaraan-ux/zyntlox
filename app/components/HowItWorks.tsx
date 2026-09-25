const steps = [
  {
    number: "01",
    title: "Paste a link",
    description: "Any public page — your homepage, a landing page, a product page.",
  },
  {
    number: "02",
    title: "Magpie takes a look",
    description: "It renders the page in a real browser, screenshots it, and checks it against a fixed checklist.",
  },
  {
    number: "03",
    title: "Get the verdict",
    description: "Problems, quick wins and next moves — in plain English if you want it.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="w-full max-w-5xl pt-24" aria-labelledby="how-heading">
      <div className="mb-10 flex flex-col items-center text-center">
        <p className="eyebrow mb-3">How it works</p>
        <h2 id="how-heading" className="font-display text-4xl sm:text-5xl">
          Link in, verdict out
        </h2>
      </div>
      <ol className="relative grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
        {/* The hairline joining the three steps on wide screens. */}
        <div aria-hidden="true" className="absolute left-[16%] right-[16%] top-5 hidden h-px bg-line-strong sm:block" />
        {steps.map((step) => (
          <li key={step.number} className="relative flex flex-col items-center text-center">
            <span className="relative mb-5 flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-paper font-mono text-xs text-ink">
              {step.number}
            </span>
            <h3 className="mb-2 font-display text-2xl">{step.title}</h3>
            <p className="max-w-[18rem] text-sm leading-relaxed text-muted">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
