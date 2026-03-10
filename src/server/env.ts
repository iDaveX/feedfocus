import { z } from "zod";

function optionalNonEmptyString() {
  return z.preprocess((v) => {
    if (typeof v !== "string") return v;
    const trimmed = v.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().min(1).optional());
}

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: optionalNonEmptyString(),
  DEV_TELEGRAM_USER_ID: optionalNonEmptyString(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // LLM provider (default: Groq if GROQ_API_KEY is set, otherwise OpenAI)
  LLM_PROVIDER: z.enum(["groq", "openai"]).optional(),

  // Groq (OpenAI-compatible API)
  GROQ_API_KEY: optionalNonEmptyString(),
  GROQ_MODEL: z.string().min(1).default("llama-3.3-70b-versatile"),

  // OpenAI (optional fallback)
  OPENAI_API_KEY: optionalNonEmptyString(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),

  DAILY_ANALYZE_LIMIT: z.coerce.number().int().positive().default(5),
  MAX_FEEDBACK_ITEMS: z.coerce.number().int().positive().max(50).default(50),
  RETENTION_DAYS: z.coerce.number().int().positive().default(30),

  CRON_SECRET: optionalNonEmptyString()
});

export type Env = z.infer<typeof envSchema> & { LLM_PROVIDER: "groq" | "openai" };

let cached: z.infer<typeof envSchema> | null = null;

export type AppMode = "telegram" | "demo" | "restricted";

function getNonEmptyProcessEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getEnv(): Env {
  if (cached) {
    const provider = (cached.LLM_PROVIDER ?? (cached.GROQ_API_KEY ? "groq" : "openai")) as "groq" | "openai";
    return { ...(cached as z.infer<typeof envSchema>), LLM_PROVIDER: provider };
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid env: ${message}`);
  }
  if (
    process.env.NODE_ENV !== "development" &&
    !parsed.data.TELEGRAM_BOT_TOKEN &&
    !parsed.data.DEV_TELEGRAM_USER_ID
  ) {
    throw new Error("Invalid env: set TELEGRAM_BOT_TOKEN (Telegram auth) or DEV_TELEGRAM_USER_ID (demo mode).");
  }

  const provider = (parsed.data.LLM_PROVIDER ?? (parsed.data.GROQ_API_KEY ? "groq" : "openai")) as "groq" | "openai";
  if (provider === "groq" && !parsed.data.GROQ_API_KEY) {
    throw new Error("Invalid env: GROQ_API_KEY is required when LLM_PROVIDER=groq.");
  }
  if (provider === "openai" && !parsed.data.OPENAI_API_KEY) {
    throw new Error("Invalid env: OPENAI_API_KEY is required when LLM_PROVIDER=openai.");
  }

  cached = parsed.data;
  return { ...(cached as z.infer<typeof envSchema>), LLM_PROVIDER: provider };
}

export function getAppMode(): AppMode {
  // IMPORTANT:
  // This function must be safe to call during `next build` / prerender.
  // Do not call `getEnv()` here (it validates Supabase/LLM env and can fail the build).
  const botToken = getNonEmptyProcessEnv("TELEGRAM_BOT_TOKEN");
  const devUserId = getNonEmptyProcessEnv("DEV_TELEGRAM_USER_ID");

  if (botToken) return "telegram";
  if (devUserId) return "demo";
  return "restricted";
}
