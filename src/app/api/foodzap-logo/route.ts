import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** PNG bytes for header / Capacitor (same path as `public/brand/foodzap-mark.png`). */
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
