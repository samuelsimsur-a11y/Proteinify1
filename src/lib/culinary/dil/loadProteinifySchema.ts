import { createRequire } from "node:module";

// Colocated with JSON so `require` resolves the same in dev, build, and Vercel serverless.
const require = createRequire(import.meta.url);

export const proteinifySchema: unknown = require("./data/proteinify_schema.json");
