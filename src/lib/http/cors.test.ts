import { describe, expect, it } from "vitest";
import { corsHeadersFor, isAllowedOrigin } from "./cors";

describe("isAllowedOrigin", () => {
  it("allows the web app and its legacy aliases", () => {
    expect(isAllowedOrigin("https://wisedish.vercel.app")).toBe(true);
    expect(isAllowedOrigin("https://foodzap-khaki.vercel.app")).toBe(true);
  });

  it("allows the Android app and local development", () => {
    expect(isAllowedOrigin("https://localhost")).toBe(true);
    expect(isAllowedOrigin("http://localhost")).toBe(true);
    expect(isAllowedOrigin("capacitor://localhost")).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:4322")).toBe(true);
  });

  it("allows this project's Vercel previews", () => {
    expect(isAllowedOrigin("https://wisedish-7uzrjwwzs-protify.vercel.app")).toBe(true);
  });

  it("rejects other websites", () => {
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
    expect(isAllowedOrigin("https://wisedish.vercel.app.evil.example")).toBe(false);
    expect(isAllowedOrigin("https://notwisedish.vercel.app")).toBe(false);
    expect(isAllowedOrigin("http://wisedish-preview.vercel.app")).toBe(false);
    expect(isAllowedOrigin(null)).toBe(false);
    expect(isAllowedOrigin("not a url")).toBe(false);
  });
});

describe("corsHeadersFor", () => {
  it("echoes allowed origins and omits the allow header otherwise", () => {
    expect(corsHeadersFor("https://localhost")["Access-Control-Allow-Origin"]).toBe("https://localhost");
    expect(corsHeadersFor("https://evil.example")["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});
