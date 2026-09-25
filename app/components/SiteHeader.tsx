import Link from "next/link";
import { Wordmark } from "./Logo";

const NAV = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#sample", label: "Sample" },
  { href: "/#faq", label: "FAQ" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Magpie home" className="text-ink">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden rounded-lg px-3 py-2 text-sm text-muted transition hover:text-ink md:inline-block"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/compare" className="btn-ghost px-3.5 py-2 text-sm">
            Compare sites
          </Link>
        </nav>
      </div>
    </header>
  );
}
