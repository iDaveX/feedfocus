import OpenAI from "openai";
import { getEnv } from "@/src/server/env";

let cached: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (cached) return cached;
  const env = getEnv();
  if (env.LLM_PROVIDER === "groq") {
    cached = new OpenAI({
      apiKey: env.GROQ_API_KEY!,
      baseURL: "https://api.groq.com/openai/v1"
    });
  } else {
    cached = new OpenAI({ apiKey: env.OPENAI_API_KEY! });
  }
  return cached;
}
