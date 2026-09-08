/**
 * Key presence, described without ever printing the key itself.
 * A standalone script doesn't get Next's automatic .env.local loading, so the npm
 * script passes --env-file-if-exists; this reports what actually landed.
 */
export function describeKeyPresence(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return "not set";
  if (key === "undefined") return 'set to the literal string "undefined" (bad)';
  return `set (${key.length} chars)`;
}

/**
 * Fails loudly for the Gemini-touching modes. Without this, an unset key is
 * interpolated into the request URL as the string "undefined", producing a 400 that
 * is not retryable — which surfaces as a generic "AI analysis failed".
 */
export function requireGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY;

  if (!key || key === "undefined") {
    console.error(
      [
        "",
        "  GEMINI_API_KEY is not set.",
        "",
        `  Current state: ${describeKeyPresence()}`,
        "",
        "  Get a key at https://aistudio.google.com/apikey, then create a .env.local:",
        "",
        "      GEMINI_API_KEY=your-key-here",
        "",
        "  (see .env.example). These modes need no key and work without it:",
        "      capture, list, inspect, path-compare, extraction-variance,",
        "      and replay with --dry-run or --mock",
        "",
      ].join("\n")
    );
    process.exit(1);
  }

  // Warn rather than fail on shape: key formats change, and a hard failure on an
  // unrecognized-but-valid key would be worse than the problem it prevents.
  if (!/^AIza[0-9A-Za-z_-]{20,}$/.test(key)) {
    console.warn(
      `  Warning: GEMINI_API_KEY doesn't match the expected format. Continuing anyway (${describeKeyPresence()}).`
    );
  }

  return key;
}
