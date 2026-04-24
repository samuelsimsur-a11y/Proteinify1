import { NextRequest, NextResponse } from "next/server";

import { API_CORS_HEADERS, withCorsHeaders } from "@/lib/http/cors";

const MAX_MESSAGE_LENGTH = 2000;

type FeedbackBody = {
  rating?: number;
  category?: string;
  message?: string;
  context?: Record<string, unknown>;
};

function requestIdFrom(req: NextRequest): string {
  return req.headers.get("x-request-id")?.trim() || crypto.randomUUID();
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: API_CORS_HEADERS,
  });
}

export async function POST(req: NextRequest) {
  const requestId = requestIdFrom(req);
  try {
    const body = (await req.json()) as FeedbackBody;
    const rating = typeof body.rating === "number" ? body.rating : null;
    const category = typeof body.category === "string" ? body.category.trim().slice(0, 80) : null;
    const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
    const context = body.context && typeof body.context === "object" ? body.context : {};

    if (!message && !category && rating === null) {
      return NextResponse.json(
        { error: "At least one feedback field is required.", code: "INVALID_REQUEST" },
        { status: 400, headers: withCorsHeaders({ "X-Request-Id": requestId }) }
      );
    }

    // Stage-B scaffold: structured event goes to logs now, persistence can be plugged in later.
    console.info("[feedback:event]", JSON.stringify({ requestId, rating, category, message, context }));

    return NextResponse.json(
      { ok: true, requestId },
      { status: 200, headers: withCorsHeaders({ "X-Request-Id": requestId }) }
    );
  } catch (error) {
    console.error("[feedback] failed:", error);
    return NextResponse.json(
      { error: "Invalid feedback payload.", code: "INVALID_PAYLOAD" },
      { status: 400, headers: withCorsHeaders({ "X-Request-Id": requestId }) }
    );
  }
}
