import { useId } from "react";

/** The Magpie mark: ink tile, white M, and the iridescent ring — "the shiny thing". */
export function LogoMark({ size = 28 }: { size?: number }) {
  const gradientId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3fb3c4" />
          <stop offset="0.5" stopColor="#7b8cff" />
          <stop offset="1" stopColor="#b690f0" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="496" height="496" rx="108" fill="#111318" stroke="rgba(255,255,255,0.14)" strokeWidth="16" />
      <g transform="translate(-12 0)">
        <path d="M158 362V150h56l42 62 42-62h56v212h-52V238l-46 62-46-62v124z" fill="#ffffff" />
        <circle cx="386" cy="362" r="23" fill="none" stroke={`url(#${gradientId})`} strokeWidth="14" />
      </g>
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="font-display text-[1.6rem] leading-none tracking-tight">Magpie</span>
    </span>
  );
}
