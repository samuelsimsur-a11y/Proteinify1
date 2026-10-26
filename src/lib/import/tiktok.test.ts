import { describe, expect, it } from "vitest";
import { isTikTokUrl } from "./tiktok";

describe("isTikTokUrl", () => {
  it("accepts TikTok links", () => {
    expect(isTikTokUrl("https://www.tiktok.com/@chef/video/123")).toBe(true);
    expect(isTikTokUrl("https://vm.tiktok.com/ZMabc/")).toBe(true);
    expect(isTikTokUrl("https://tiktok.com/@chef/video/123")).toBe(true);
  });

  it("rejects look-alike hosts and other schemes", () => {
    expect(isTikTokUrl("https://tiktok.com.evil.site/x")).toBe(false);
    expect(isTikTokUrl("https://nottiktok.com/x")).toBe(false);
    expect(isTikTokUrl("file:///etc/passwd")).toBe(false);
    expect(isTikTokUrl("not a url")).toBe(false);
  });
});
