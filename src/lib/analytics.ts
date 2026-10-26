/**
 * Funnel events for Microsoft Clarity (already loaded in app/layout.tsx). In the Clarity
 * dashboard: Filters → Custom events / Custom tags, e.g. "generate_succeeded" or "cooked".
 * Every call is fire-and-forget and never throws.
 */

export type AnalyticsEvent =
  | "generate_started"
  | "generate_quick_ready"
  | "generate_succeeded"
  | "generate_failed"
  | "example_opened"
  | "saved_recipe_opened"
  | "swap_requested"
  | "swap_succeeded"
  | "swap_failed"
  | "recipe_copied"
  | "recipe_shared"
  | "cooked"
  | "milestone_unlocked"
  | "feedback_sent";

type Props = Record<string, string | number | boolean | null | undefined>;

type ClarityFn = (...args: unknown[]) => void;

function clarity(): ClarityFn | null {
  if (typeof window === "undefined") return null;
  const c = (window as Window & { clarity?: ClarityFn }).clarity;
  return typeof c === "function" ? c : null;
}

export function track(event: AnalyticsEvent, props: Props = {}): void {
  try {
    const c = clarity();
    if (!c) return;
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null) continue;
      c("set", key, String(value).slice(0, 100));
    }
    c("event", event);
  } catch {
    // Analytics must never break the app.
  }
}
