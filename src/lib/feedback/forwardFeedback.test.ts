import { afterEach, describe, expect, it, vi } from "vitest";
import { formatFeedbackText, forwardFeedback, normalizeFeedback } from "./forwardFeedback";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("normalizeFeedback", () => {
  it("rejects empty feedback", () => {
    expect(normalizeFeedback({})).toBeNull();
    expect(normalizeFeedback({ message: "   " })).toBeNull();
  });

  it("keeps known context keys only and clamps values", () => {
    const f = normalizeFeedback({
      rating: 9,
      category: "cooked",
      context: { dish: "mac & cheese", version: "max-protein", secret: "nope", proteinAfter: 71 },
    });
    expect(f).toEqual({
      rating: 2,
      category: "cooked",
      message: "",
      context: { dish: "mac & cheese", version: "max-protein", proteinAfter: 71 },
    });
  });
});

describe("formatFeedbackText", () => {
  it("formats a cooked rating", () => {
    const text = formatFeedbackText(
      { rating: 2, category: "cooked", message: "", context: { dish: "biryani", proteinBefore: 22, proteinAfter: 56 } },
      "req-1"
    );
    expect(text).toContain("🔥");
    expect(text).toContain("Someone cooked a Wise Dish");
    expect(text).toContain("Protein: 22g → 56g");
  });
});

describe("forwardFeedback", () => {
  it("does nothing without a webhook", async () => {
    vi.stubEnv("FEEDBACK_WEBHOOK_URL", "");
    expect(await forwardFeedback({ rating: 1, category: null, message: "hi", context: {} }, "r")).toBe(false);
  });

  it("posts Discord-shaped payloads without pinging anyone", async () => {
    vi.stubEnv("FEEDBACK_WEBHOOK_URL", "https://discord.com/api/webhooks/123/abc");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    const ok = await forwardFeedback({ rating: -1, category: "tasted weird", message: "@everyone hi", context: {} }, "r");
    expect(ok).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.allowed_mentions).toEqual({ parse: [] });
    expect(body.content).toContain("tasted weird");
  });

  it("swallows webhook errors", async () => {
    vi.stubEnv("FEEDBACK_WEBHOOK_URL", "https://hooks.slack.com/services/x");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await forwardFeedback({ rating: 1, category: null, message: "hi", context: {} }, "r")).toBe(false);
  });
});
