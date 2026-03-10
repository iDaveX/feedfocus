import { getTelegramInitData } from "@/src/client/telegram";

let sessionId: string | null = null;

function getSessionId(): string {
  if (sessionId) return sessionId;
  const key = "fti_session_id";
  const existing = sessionStorage.getItem(key);
  if (existing) {
    sessionId = existing;
    return existing;
  }
  const created = crypto.randomUUID();
  sessionStorage.setItem(key, created);
  sessionId = created;
  return created;
}

export async function trackEvent(name: string, meta: Record<string, unknown>) {
  const initData = getTelegramInitData();
  const payload = {
    name,
    meta: {
      ...meta,
      session_id: getSessionId(),
      client_ts: new Date().toISOString()
    }
  };

  await fetch("/api/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(initData ? { "x-telegram-init-data": initData } : {})
    },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => undefined);
}

