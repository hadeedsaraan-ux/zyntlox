import Link from "next/link";
import { Wordmark } from "./Logo";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface/60">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div className="space-y-2">
          <Wordmark />
          <p className="max-w-xs text-sm text-muted">
            Sharp-eyed website reviews. Every flaw spotted, every fix spelled out.
          </p>
        </div>
        <div className="flex flex-col gap-3 text-sm text-muted sm:items-end">
          <nav aria-label="Footer" className="flex gap-5">
            <Link href="/compare" className="transition hover:text-ink">
              Compare sites
            </Link>
            <Link href="/#faq" className="transition hover:text-ink">
              FAQ
            </Link>
            <Link href="/privacy" className="transition hover:text-ink">
              Privacy
            </Link>
          </nav>
          <p className="font-mono text-[11px] tracking-wide">© {new Date().getFullYear()} Magpie</p>
        </div>
      </div>
    </footer>
  );
}
