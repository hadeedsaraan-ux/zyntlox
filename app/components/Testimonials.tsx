const testimonials = [
  {
    quote:
      "At Dionix AI, we've had early access to [Magpie] and have been using it for our SEO clients. The reports are simple, fast, and make it easy to spot key SEO issues and quick wins.",
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
    <section className="w-full max-w-5xl pt-24" aria-labelledby="testimonials-heading">
      <div className="mb-10 flex flex-col items-center text-center">
        <p className="eyebrow mb-3">Early feedback</p>
        <h2 id="testimonials-heading" className="font-display text-4xl sm:text-5xl">
          What early users say
        </h2>
      </div>
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {testimonials.map((t) => (
          <figure key={t.name} className="card mb-4 break-inside-avoid p-6">
            <span aria-hidden="true" className="sheen-text block font-display text-5xl leading-none">
              &ldquo;
            </span>
            <blockquote className="-mt-2 font-display text-xl leading-snug text-ink">{t.quote}</blockquote>
            <figcaption className="mt-5 flex items-start gap-2.5 text-sm">
              <span className="ring-marker mt-[5px] text-accent" aria-hidden="true" />
              <span>
                <span className="block font-medium text-ink">{t.name}</span>
                {t.title && <span className="block text-muted">{t.title}</span>}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
