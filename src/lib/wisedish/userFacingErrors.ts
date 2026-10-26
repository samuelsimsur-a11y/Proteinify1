/** Map API / client errors to cook-friendly copy (no dev env hints). */
export function humanizeGenerateError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  if (/WISEDISH_USE_MOCK|OPENAI_API_KEY/i.test(s)) {
    return "Generation is temporarily unavailable. Try again in a moment.";
  }
  if (/timed out|timeout/i.test(s)) {
    return "That took too long — complex dishes can need 1–2 minutes. Try again or simplify the dish name.";
  }
  if (/No internet|offline|network error|could not reach/i.test(s)) {
    return "No connection — check Wi‑Fi or mobile data, then try again.";
  }
  if (/429|Too many requests|rate limit/i.test(s)) {
    return "Too many requests — wait a minute and try again.";
  }
  if (/parse|truncated|502|empty response/i.test(s)) {
    return "We got an incomplete recipe back. Try again — shorter dish names help.";
  }
  if (/dish and mode are required|must not be empty/i.test(s)) {
    return "Enter a dish name first.";
  }
  if (/Tell us what to use instead|Missing ingredient to swap/i.test(s)) {
    return s;
  }
  if (
    /Expected SSE|non-JSON|incomplete|must be (Close Match|Balanced|Full Send)|versions\[|versions must|Missing or invalid|not a JSON object|Unexpected response shape|Stream ended|complete payload/i.test(
      s
    )
  ) {
    return "We got an incomplete recipe back. Try again — shorter dish names help.";
  }
  const status = /\((\d{3})\)|\[(\d{3})\]/.exec(s);
  const code = status ? Number(status[1] ?? status[2]) : null;
  if (code !== null && code >= 500) {
    return "Our kitchen had a hiccup on the server. Try again in a moment.";
  }
  if (code !== null && code >= 400) {
    return "That request didn't work. Try a different dish name or try again.";
  }
  // Never show raw URLs or stack-ish details to cooks.
  if (/https?:\/\/|@ \//.test(s)) {
    return "Something went wrong on our side. Try again in a moment.";
  }

  return s.length > 220 ? `${s.slice(0, 217)}…` : s;
}
