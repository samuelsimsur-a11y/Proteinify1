import { describe, expect, it } from "vitest";
import { humanizeGenerateError } from "./userFacingErrors";

describe("humanizeGenerateError", () => {
  it("hides transport details behind cook-friendly copy", () => {
    expect(humanizeGenerateError("Expected SSE stream from /api/generate.")).toMatch(/incomplete recipe/);
    expect(humanizeGenerateError("Request failed (500) at https://wisedish.vercel.app/api/generate")).toMatch(/hiccup/);
    expect(humanizeGenerateError("Internal server error [500] @ https://wisedish.vercel.app/api/generate")).toMatch(/hiccup/);
    expect(humanizeGenerateError("versions[0] must be Close Match.")).toMatch(/incomplete recipe/);
    expect(humanizeGenerateError("Request failed (404) at https://x")).toMatch(/didn't work/);
  });

  it("keeps rate-limit, offline and timeout messages specific", () => {
    expect(humanizeGenerateError("Too many requests — try again in a few minutes. [429] @ x")).toMatch(/wait a minute/);
    expect(humanizeGenerateError("No internet connection detected.")).toMatch(/No connection/);
    expect(humanizeGenerateError("That took too long — try again.")).toMatch(/took too long/);
  });

  it("passes short plain messages through", () => {
    expect(humanizeGenerateError("Tell us what to use instead.")).toBe("Tell us what to use instead.");
    expect(humanizeGenerateError("No recipe found in that video.")).toBe("No recipe found in that video.");
  });
});
