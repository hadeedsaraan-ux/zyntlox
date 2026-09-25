import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy Policy — Magpie",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-8">
      <h2 className="mb-3 font-display text-2xl">{title}</h2>
      <div className="leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

function Point({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="ring-marker mt-[7px] text-accent" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

export default function PrivacyPage() {
  return (
    <main className="flex flex-col items-center px-4 pt-14 sm:px-6">
      <article className="w-full max-w-2xl">
        <p className="eyebrow mb-3">Legal</p>
        <h1 className="mb-3 font-display text-5xl">Privacy Policy</h1>
        <p className="mb-10 font-mono text-xs text-muted">Last updated: August 22, 2026</p>

        <div className="space-y-8">
          <Section title="What Magpie does">
            <p>
              You submit a website URL. We fetch that page&apos;s publicly available HTML, pull a
              screenshot of it, and send both to an AI model for analysis. We return the resulting
              report to you in your browser. That&apos;s the entire flow — there are no user
              accounts, logins, or profiles.
            </p>
          </Section>

          <Section title="What we collect and share">
            <ul className="space-y-3">
              <Point>
                The URL you submit is sent to our own scraping service, which loads the page in a
                headless browser to capture a screenshot and its text. Pages are processed in memory
                and are not stored.
              </Point>
              <Point>
                That screenshot and page text, along with facts we extract from the public HTML, are
                sent to <strong className="font-semibold text-ink">Google Gemini</strong> for analysis.
              </Point>
              <Point>
                We use <strong className="font-semibold text-ink">Vercel Analytics</strong> to
                understand aggregate site traffic (e.g. page views). It does not use cookies for
                cross-site tracking.
              </Point>
            </ul>
          </Section>

          <Section title="What we don't do">
            <p>
              We don&apos;t store submitted URLs, scraped page content, screenshots, or generated
              reports on our servers — each request is processed and returned directly to your
              browser. We don&apos;t require or collect accounts, emails, or personal information to
              use the tool. We don&apos;t sell data.
            </p>
          </Section>

          <Section title="Only submit URLs you're allowed to scan">
            <p>
              Since submitting a URL causes our server to fetch and screenshot that page, only use
              Magpie on websites you own or otherwise have permission to analyze.
            </p>
          </Section>

          <Section title="Questions">
            <p>
              This policy covers a small, independently run tool. If you have questions about it, a
              contact channel isn&apos;t set up yet — check back here for updates.
            </p>
          </Section>
        </div>
      </article>
    </main>
  );
}
