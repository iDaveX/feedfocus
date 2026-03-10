import posthog from "posthog-js";

const ANON_STORAGE_KEY = "feedfocus_anon_id";
let initialized = false;

function getOrCreateAnonId(): string | null {
  try {
    if (typeof window === "undefined") return null;
    const existing = window.localStorage.getItem(ANON_STORAGE_KEY);
    if (existing && existing.trim().length > 0) return existing;

    const uuid =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `anon_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    window.localStorage.setItem(ANON_STORAGE_KEY, uuid);
    return uuid;
  } catch {
    return null;
  }
}

export function initPosthog() {
  if (typeof window === "undefined") return;
  if (initialized) return;
  initialized = true;

  posthog.init("phc_HaZ7OQpEvXo8wYDy9LXlYv77S4mscCHVhbdvCTw5oru", {
    api_host: "https://us.i.posthog.com",
    capture_pageview: true
  });

  const anonId = getOrCreateAnonId();
  if (anonId) {
    posthog.identify(anonId);
  }
}

export { posthog };

