"use client";

import { useEffect } from "react";
import { initPosthog } from "@/src/lib/posthog";

export default function PosthogInit({ apiKey, apiHost }: { apiKey: string; apiHost: string }) {
  useEffect(() => {
    initPosthog({ apiKey, apiHost });
  }, [apiHost, apiKey]);

  return null;
}
