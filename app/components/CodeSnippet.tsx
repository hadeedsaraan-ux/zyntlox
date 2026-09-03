"use client";

import { useState } from "react";
import { CodeSnippet as CodeSnippetType } from "../lib/types";

export default function CodeSnippet({ snippet }: { snippet: CodeSnippetType }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — nothing to fall back to.
    }
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-card-hover)] border-b border-[var(--border)]">
        <span className="font-mono text-[10px] tracking-widest uppercase text-[var(--muted)]">
          {snippet.language}
        </span>
        <button
          onClick={handleCopy}
          className="font-mono text-[10px] tracking-widest uppercase text-[var(--muted)] hover:text-[var(--amber)] transition"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="px-3 py-2 overflow-x-auto">
        <code className="font-mono text-[12px] leading-relaxed text-[var(--text)] whitespace-pre">
          {snippet.code}
        </code>
      </pre>
    </div>
  );
}
