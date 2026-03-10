import { z } from "zod";

function optionalNonEmptyString() {
  return z.preprocess((v) => {
    if (typeof v !== "string") return v;
    const trimmed = v.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().min(1).optional());
}

const envSchema = z.object({
  // Optional fixed user id for demos (all visitors share one user)
  DEV_USER_ID: optionalNonEmptyString(),

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
