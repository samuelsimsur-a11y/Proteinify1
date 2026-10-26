/**
 * Feedback from the app (ratings, "I cooked this", bug notes) forwarded to a chat webhook so it
 * survives — Vercel only keeps function logs briefly. Set FEEDBACK_WEBHOOK_URL to a Discord or
 * Slack incoming-webhook URL in the Vercel project's environment variables.
 */

const MAX_MESSAGE_LENGTH = 2000;
const CONTEXT_KEYS = [
  "dish",
  "version",
  "transformationMode",
  "resultId",
  "source",
  "platform",
  "appVersion",
  "proteinBefore",
  "proteinAfter",
] as const;

export type FeedbackBody = {
  rating?: unknown;
  category?: unknown;
  message?: unknown;
  context?: unknown;
};

export type NormalizedFeedback = {
  rating: number | null;
  category: string | null;
  message: string;
  context: Partial<Record<(typeof CONTEXT_KEYS)[number], string | number>>;
};

export function normalizeFeedback(body: FeedbackBody | null | undefined): NormalizedFeedback | null {
  if (!body || typeof body !== "object") return null;
  const rating =
    typeof body.rating === "number" && Number.isFinite(body.rating)
      ? Math.max(-2, Math.min(2, Math.round(body.rating)))
      : null;
  const category = typeof body.category === "string" ? body.category.trim().slice(0, 80) || null : null;
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
  if (!message && !category && rating === null) return null;

  const context: NormalizedFeedback["context"] = {};
  if (body.context && typeof body.context === "object") {
    const raw = body.context as Record<string, unknown>;
    for (const key of CONTEXT_KEYS) {
      const v = raw[key];
      if (typeof v === "string" && v.trim()) context[key] = v.trim().slice(0, 120);
      else if (typeof v === "number" && Number.isFinite(v)) context[key] = v;
    }
  }
  return { rating, category, message, context };
}

const RATING_EMOJI: Record<string, string> = { "2": "🔥", "1": "👍", "0": "😐", "-1": "👎", "-2": "👎" };

export function formatFeedbackText(f: NormalizedFeedback, requestId: string): string {
  const heading = f.category === "cooked" ? "Someone cooked a Wise Dish" : "Wise Dish feedback";
  const emoji = f.rating === null ? "💬" : RATING_EMOJI[String(f.rating)] ?? "💬";
  const lines = [`${emoji} **${heading}**${f.category && f.category !== "cooked" ? ` · ${f.category}` : ""}`];
  const c = f.context;
  const meta = [
    c.dish ? `Dish: ${c.dish}` : null,
    c.version ? `Version: ${c.version}` : null,
    c.transformationMode ? `Mode: ${c.transformationMode}` : null,
    c.proteinBefore !== undefined && c.proteinAfter !== undefined ? `Protein: ${c.proteinBefore}g → ${c.proteinAfter}g` : null,
    c.platform ? `Platform: ${c.platform}` : null,
    c.appVersion ? `App: ${c.appVersion}` : null,
  ].filter(Boolean);
  if (meta.length) lines.push(meta.join(" · "));
  if (f.message) lines.push(`> ${f.message.replace(/\n/g, "\n> ")}`);
  lines.push(`\`${requestId}\``);
  return lines.join("\n").slice(0, 1900);
}

function webhookKind(url: URL): "discord" | "slack" | "generic" {
  const host = url.hostname.toLowerCase();
  if (host === "discord.com" || host === "discordapp.com" || host.endsWith(".discord.com")) return "discord";
  if (host === "hooks.slack.com") return "slack";
  return "generic";
}

/** Returns true when the webhook accepted the feedback. Never throws. */
export async function forwardFeedback(f: NormalizedFeedback, requestId: string): Promise<boolean> {
  const raw = process.env.FEEDBACK_WEBHOOK_URL?.trim();
  if (!raw) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    console.warn("[feedback] FEEDBACK_WEBHOOK_URL is not a valid URL");
    return false;
  }
  if (url.protocol !== "https:") return false;

  const text = formatFeedbackText(f, requestId);
  const kind = webhookKind(url);
  const payload =
    kind === "discord"
      ? { content: text, allowed_mentions: { parse: [] } }
      : kind === "slack"
        ? { text: text.replace(/\*\*/g, "*") }
        : { text, feedback: f, requestId };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) console.warn(`[feedback] webhook responded ${res.status}`);
    return res.ok;
  } catch (err) {
    console.warn("[feedback] webhook failed:", err instanceof Error ? err.message : err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
