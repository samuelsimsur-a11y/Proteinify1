import { createRequire } from "node:module";

let cached: unknown | undefined;
let loadFailed: unknown;

/**
 * Lazy-load schema JSON so import/require errors are catchable and loggable in route handlers.
 */
export function getProteinifySchema(): unknown {
  if (loadFailed !== undefined) {
    throw loadFailed instanceof Error ? loadFailed : new Error(String(loadFailed));
  }
  if (cached !== undefined) {
    return cached;
  }
  try {
    const require = createRequire(import.meta.url);
    cached = require("./data/proteinify_schema.json");
    return cached;
  } catch (err) {
    console.error("[generate] proteinify_schema.json load failed:", err);
    loadFailed = err;
    throw err;
  }
}
