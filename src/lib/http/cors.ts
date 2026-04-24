export const API_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-Request-Id",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

export function withCorsHeaders(headers?: HeadersInit): Headers {
  const out = new Headers(API_CORS_HEADERS);
  if (!headers) return out;
  const extra = new Headers(headers);
  extra.forEach((value, key) => out.set(key, value));
  return out;
}
