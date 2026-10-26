import { NextResponse } from "next/server";

import { getPublicEnvForHealth } from "@/lib/config/env";

export const dynamic = "force-static";

/** Health is public and static, so any origin may read it. */
const HEALTH_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: HEALTH_CORS_HEADERS,
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
    { headers: HEALTH_CORS_HEADERS }
  );
}
