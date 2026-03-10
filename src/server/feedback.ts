import { getEnv } from "@/src/server/env";

export function parseFeedbackItems(raw: string): string[] {
  const env = getEnv();
  const maxItems = env.MAX_FEEDBACK_ITEMS;
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const lines = normalized
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .map((x) => x.replace(/^[-•\u2022]\s+/, "").replace(/^\d+[.)]\s+/, ""));

  if (lines.length <= 1) return [normalized].slice(0, maxItems);
  return lines.slice(0, maxItems);
}

