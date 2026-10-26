import { postApiJson } from "@/lib/wisedish/clientGenerate";
import { isCapacitorNative } from "@/lib/capacitorEnv";
import { track } from "@/lib/analytics";

export type FeedbackPayload = {
  rating?: number;
  category?: string;
  message?: string;
  context?: Record<string, string | number | undefined>;
};

const APP_VERSION = process.env.NEXT_PUBLIC_WISEDISH_APP_VERSION ?? "";

/**
 * Sends feedback to /api/feedback on the API host (works from the Android app too — the old
 * relative URL only reached the bundled static files there). Returns true when the server got it.
 */
export async function sendFeedback(payload: FeedbackPayload): Promise<boolean> {
  const body = {
    ...payload,
    context: {
      ...payload.context,
      platform: isCapacitorNative() ? "android" : "web",
      ...(APP_VERSION ? { appVersion: APP_VERSION } : {}),
    },
  };
  const r = await postApiJson("/api/feedback", body, 15_000);
  const ok = r.ok && r.status < 400;
  if (ok) track("feedback_sent", { category: payload.category ?? "general" });
  return ok;
}
