import { NextResponse } from "next/server";

import { getPublicEnvForHealth } from "@/lib/config/env";
import { API_CORS_HEADERS, withCorsHeaders } from "@/lib/http/cors";

export const dynamic = "force-static";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: API_CORS_HEADERS,
  });
}

export async function GET() {
  const now = new Date().toISOString();
  return NextResponse.json(
    {
      ok: true,
      timestamp: now,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      env: getPublicEnvForHealth(),
    },
    { headers: withCorsHeaders() }
  );
}
