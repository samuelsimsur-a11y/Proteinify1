import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Serves the logo bytes explicitly. Some Vercel setups were not exposing nested `public/brand/*`
 * as static files (404); this route always ships with the function bundle.
 */
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "brand", "foodzap-mark.png");
    const buf = await readFile(filePath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
