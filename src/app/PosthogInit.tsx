"use client";

import { useEffect } from "react";
import { initPosthog } from "@/src/lib/posthog";

export default function PosthogInit() {
  useEffect(() => {
    initPosthog();
  }, []);

  return null;
}

