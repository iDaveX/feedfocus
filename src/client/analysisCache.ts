"use client";

import type { AnalysisDetails } from "@/src/shared/api";

const PREFIX = "ff_analysis_cache:";

export function saveAnalysisCache(details: AnalysisDetails) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(`${PREFIX}${details.analysis.id}`, JSON.stringify(details));
}

export function readAnalysisCache(id: string): AnalysisDetails | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(`${PREFIX}${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AnalysisDetails;
  } catch {
    return null;
  }
}
