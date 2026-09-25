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
    <section className="w-full max-w-2xl mt-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="text-center mb-6">
        <span className="font-mono text-[11px] tracking-widest text-[var(--muted)] uppercase">
          Questions
        </span>
        <h2 className="font-display text-2xl font-bold mt-2">FAQ</h2>
      </div>
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4">
        {faqs.map(({ q, a }) => (
          <details key={q} className="group border-b border-[var(--border)] last:border-0">
            <summary className="flex items-center justify-between gap-3 cursor-pointer list-none py-4 font-display font-bold hover:text-[var(--amber)] transition-colors">
              {q}
              <span className="shrink-0 font-mono text-[var(--muted)] group-open:rotate-45 transition-transform">
                +
              </span>
            </summary>
            <p className="text-[var(--muted)] text-sm leading-relaxed pb-4 -mt-1">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
