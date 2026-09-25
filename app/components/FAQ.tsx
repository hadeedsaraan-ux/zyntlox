const faqs = [
  {
    q: "What is Magpie?",
    a: "Magpie gives your website a brutally honest review in under 60 seconds. Paste a URL and you get specific, actionable feedback on design, trust, UX and SEO — what's hurting you, quick wins, and what to fix next.",
  },
  {
    q: "How does it work?",
    a: "We load your page in a real browser, scroll it top to bottom and take a full-page screenshot. Objective things like alt text, meta tags and links are checked automatically by code; AI reviews the screenshot and content for everything else, against a fixed checklist.",
  },
  {
    q: "What does the report check?",
    a: "Design (layout, visual hierarchy, readability), trust (contact details, policies, social proof), UX (navigation, calls to action, forms) and SEO basics (title, meta description, headings, image alt text, whether search engines can index the page).",
  },
  {
    q: "Do I need an account?",
    a: "No. There's no sign-up and no login — just paste a URL.",
  },
  {
    q: "Is it free?",
    a: "Yes, the audit is free to use right now.",
  },
  {
    q: "Do you store my website or my report?",
    a: "No. Pages are processed in memory and the report is sent straight to your browser — we don't keep URLs, screenshots or reports. Export the PDF if you want to keep a copy.",
  },
  {
    q: "Can I audit any website?",
    a: "Only sites you own or have permission to analyse. Pages behind a login, and sites that block automated browsers, can't be audited.",
  },
  {
    q: "Why can two runs on the same site differ slightly?",
    a: "The automated checks give the same answer every run. The written suggestions come from AI, so their wording and emphasis can shift a little between runs — we measure that variation and keep narrowing it.",
  },
  {
    q: "Can I compare my site with a competitor's?",
    a: "Yes. Compare audits two URLs side by side and explains where each one is ahead and why.",
  },
  {
    q: "Is the report too technical if I'm not a developer?",
    a: "No. Switch any report between Technical and Plain English wording, and export it as a PDF to share with your team or clients.",
  },
];

// FAQPage structured data, so the questions are eligible for rich results in search.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export default function FAQ() {
  return (
    <section id="faq" className="w-full max-w-5xl pt-24" aria-labelledby="faq-heading">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-12">
        <div className="md:sticky md:top-24 md:self-start">
          <p className="eyebrow mb-3">FAQ</p>
          <h2 id="faq-heading" className="font-display text-4xl sm:text-5xl">
            Questions, answered
          </h2>
          <p className="mt-4 max-w-xs leading-relaxed text-muted">
            The short version: paste a link, get honest feedback, nothing is kept.
          </p>
        </div>
        <div className="card divide-y divide-line px-5 sm:px-6">
          {faqs.map(({ q, a }) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium text-ink transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
                {q}
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-sm text-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="-mt-1 pb-5 pr-10 text-[15px] leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
