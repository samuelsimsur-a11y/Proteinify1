import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Fork+lightning PNG (`public/brand/foodzap-mark.png`). Path is unique to avoid stale CDN 404 on older `/api/foodzap-logo`. */
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "public", "brand", "foodzap-mark.png");
    const buf = await readFile(filePath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
