import posthog from "posthog-js";

const USER_STORAGE_KEY = "feedfocus_user_id";
const USER_COOKIE_KEY = "ff_uid";
let initialized = false;

function getCookie(name: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = document.cookie || "";
    const parts = raw.split(";").map((p) => p.trim());
    for (const p of parts) {
      if (!p.startsWith(`${name}=`)) continue;
      return decodeURIComponent(p.slice(name.length + 1));
    }
    return null;
  } catch {
    return null;
  }
}

function setCookie(name: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
  } catch {
    // ignore
  }
}

function getOrCreateUserId(): string | null {
  try {
    if (typeof window === "undefined") return null;

    const cookieId = getCookie(USER_COOKIE_KEY);
    if (cookieId && cookieId.trim().length > 0) {
      window.localStorage.setItem(USER_STORAGE_KEY, cookieId);
      return cookieId;
    }

    const existing = window.localStorage.getItem(USER_STORAGE_KEY);
    if (existing && existing.trim().length > 0) {
      setCookie(USER_COOKIE_KEY, existing);
      return existing;
    }

    const uuid =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `anon_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    window.localStorage.setItem(USER_STORAGE_KEY, uuid);
    setCookie(USER_COOKIE_KEY, uuid);
    return uuid;
  } catch {
    return null;
  }
}

export function initPosthog({ apiKey, apiHost }: { apiKey: string; apiHost: string }) {
  if (typeof window === "undefined") return;
  if (initialized) return;
  initialized = true;

  if (!apiKey || apiKey.trim().length === 0) return;

  posthog.init(apiKey, {
    api_host: apiHost,
    capture_pageview: true
  });

  const userId = getOrCreateUserId();
  if (userId) {
    posthog.identify(userId);
  }
}

export { posthog };
