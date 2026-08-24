import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t border-[var(--border)] mt-16 py-8 px-4">
      <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--muted)]">
        <p>© {new Date().getFullYear()} ZYNTLOX. All rights reserved.</p>
        <nav aria-label="Footer" className="flex gap-4">
          <Link href="/privacy" className="hover:text-[var(--text)] transition">
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
