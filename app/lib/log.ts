/**
 * One structured JSON line per event. There is no database, so this is what makes real
 * traffic diagnosable after the fact: which extraction path ran, which model answered,
 * and how the scores broke down on the run a user is asking about.
 *
 * console.log (not error) — these are successes and shouldn't trip error alerting.
 * Never log the API key, the screenshot, or the prompt text (promptChars only).
 */
export function logEvent(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...fields }));
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid-url";
  }
}
