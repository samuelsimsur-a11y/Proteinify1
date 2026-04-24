import { z } from "zod";

const serverEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required for /api/generate and /api/import."),
  OPENAI_MODEL: z.string().min(1).optional(),
  YOUTUBE_API_KEY: z.string().min(1).optional(),
  PROTEINIFY_USE_MOCK: z.enum(["true", "false"]).optional(),
});

let parsedServerEnv: z.infer<typeof serverEnvSchema> | null = null;

export function getServerEnv(): z.infer<typeof serverEnvSchema> {
  if (parsedServerEnv) return parsedServerEnv;
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(result.error.issues.map((i) => i.message).join(" "));
  }
  parsedServerEnv = result.data;
  return parsedServerEnv;
}

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_API_FALLBACK_URLS: z.string().optional(),
  NEXT_PUBLIC_FOODZAP_BUILD_ID: z.string().optional(),
});

export function getPublicEnvForHealth() {
  const result = publicEnvSchema.safeParse(process.env);
  if (!result.success) {
    return { valid: false as const, errors: result.error.issues.map((i) => i.message) };
  }
  return {
    valid: true as const,
    values: {
      hasApiBaseUrl: Boolean(result.data.NEXT_PUBLIC_API_BASE_URL),
      hasApiFallbacks: Boolean(result.data.NEXT_PUBLIC_API_FALLBACK_URLS),
      hasBuildId: Boolean(result.data.NEXT_PUBLIC_FOODZAP_BUILD_ID),
    },
  };
}
