const testimonials = [
  {
    quote:
      "At Dionix AI, we've had early access to Zyntlox and have been using it for our SEO clients. The reports are simple, fast, and make it easy to spot key SEO issues and quick wins.",
    name: "Ali",
    title: "Dionix AI",
  },
  {
    quote: "It's really good — great job making it.",
    name: "Muddassir Zaman",
    title: "Co-founder & CEO, BiSol Labs",
  },
  {
    quote:
      "It gives a real in-depth review of your website and also gives suggestions on what to do... Either way, a very nice idea.",
    name: "Samawat Arsalan Hyder",
    title: "mailsolv.com",
  },
  {
    quote: "Really amazing work, this is a really useful product.",
    name: "Hayat Nabi",
    title: null,
  },
  {
    quote:
      "Amazing product. Tested my website on it and it gave me some really good pointers and fixes.",
    name: "Beta Tester",
    title: "tested on mobile",
  },
];

export default function Testimonials() {
  return (
    <section className="w-full max-w-2xl mt-12">
      <div className="text-center mb-6">
        <span className="font-mono text-[11px] tracking-widest text-[var(--muted)] uppercase">
          Early Feedback
        </span>
        <h2 className="font-display text-2xl font-bold mt-2">What People Are Saying</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {testimonials.map((t) => (
          <div
            key={t.name}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4"
          >
            <p className="text-[var(--text)] opacity-90 text-sm leading-relaxed mb-3">
              &ldquo;{t.quote}&rdquo;
            </p>
            <p className="font-mono text-[11px] tracking-wide text-[var(--amber)]">
              {t.name}
              {t.title && <span className="text-[var(--muted)]"> · {t.title}</span>}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
