import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — ZYNTLOX",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-16 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <h1 className="font-display text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-[var(--muted)] mb-10">Last updated: August 22, 2026</p>

        <div className="space-y-8">
          <section>
            <h2 className="font-display font-bold text-lg mb-2">What ZYNTLOX does</h2>
            <p className="text-[var(--text)] opacity-90 leading-relaxed">
              You submit a website URL. We fetch that page's publicly available HTML,
              pull a screenshot of it, and send both to an AI model for analysis. We
              return the resulting report to you in your browser. That's the entire flow —
              there are no user accounts, logins, or profiles.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-2">What we collect and share</h2>
            <ul className="space-y-2 text-[var(--text)] opacity-90 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-[var(--amber)] font-mono">→</span>
                The URL you submit, and the public HTML of that page, are sent to{" "}
                <strong>Google Gemini</strong> for analysis.
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--amber)] font-mono">→</span>
                A screenshot of the submitted page is generated via{" "}
                <strong>Microlink</strong> and also sent to Google Gemini as part of the analysis.
              </li>
              <li className="flex gap-2">
                <span className="text-[var(--amber)] font-mono">→</span>
                We use <strong>Vercel Analytics</strong> to understand aggregate site traffic
                (e.g. page views). It does not use cookies for cross-site tracking.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-2">What we don't do</h2>
            <p className="text-[var(--text)] opacity-90 leading-relaxed">
              We don't store submitted URLs, scraped page content, screenshots, or generated
              reports on our servers — each request is processed and returned directly to
              your browser. We don't require or collect accounts, emails, or personal
              information to use the tool. We don't sell data.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-2">Only submit URLs you're allowed to scan</h2>
            <p className="text-[var(--text)] opacity-90 leading-relaxed">
              Since submitting a URL causes our server to fetch and screenshot that page,
              only use ZYNTLOX on websites you own or otherwise have permission to analyze.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-2">Questions</h2>
            <p className="text-[var(--text)] opacity-90 leading-relaxed">
              This policy covers a small, independently run tool. If you have questions
              about it, a contact channel isn't set up yet — check back here for updates.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
