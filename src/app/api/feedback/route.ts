import { NextRequest, NextResponse } from "next/server";

import { originOf, withCorsHeaders } from "@/lib/http/cors";
import { forwardFeedback, normalizeFeedback, type FeedbackBody } from "@/lib/feedback/forwardFeedback";

function requestIdFrom(req: NextRequest): string {
  return req.headers.get("x-request-id")?.trim() || crypto.randomUUID();
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: withCorsHeaders(originOf(req)),
  });
}

export async function POST(req: NextRequest) {
  const requestId = requestIdFrom(req);
  const headers = withCorsHeaders(originOf(req), { "X-Request-Id": requestId });
  try {
    const feedback = normalizeFeedback((await req.json()) as FeedbackBody);
    if (!feedback) {
      return NextResponse.json(
        { error: "At least one feedback field is required.", code: "INVALID_REQUEST" },
        { status: 400, headers }
      );
    }

    // Logs are short-lived on Vercel; the webhook (Discord/Slack) is the durable copy.
    console.info("[feedback:event]", JSON.stringify({ requestId, ...feedback }));
    const delivered = await forwardFeedback(feedback, requestId);

    return NextResponse.json({ ok: true, requestId, delivered }, { status: 200, headers });
  } catch (error) {
    console.error("[feedback] failed:", error);
    return NextResponse.json(
      { error: "Invalid feedback payload.", code: "INVALID_PAYLOAD" },
      { status: 400, headers }
    );
  }
}
