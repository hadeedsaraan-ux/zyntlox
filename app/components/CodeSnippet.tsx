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
    <div className="overflow-hidden rounded-xl border border-line bg-surface-2">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="font-mono text-[10.5px] uppercase tracking-widest text-muted">{snippet.language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="font-mono text-[10.5px] uppercase tracking-widest text-muted transition hover:text-accent"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5">
        <code className="whitespace-pre font-mono text-[12.5px] leading-relaxed text-ink">{snippet.code}</code>
      </pre>
    </div>
  );
}
