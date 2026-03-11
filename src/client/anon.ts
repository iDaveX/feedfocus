"use client";

const COOKIE_NAME = "ff_uid";
const STORAGE_KEY = "ff_uid";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  const value = match?.[1];
  return value ? decodeURIComponent(value) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

export function getClientAnonId(): string {
  if (typeof window === "undefined") return "";

  const cookieValue = readCookie(COOKIE_NAME)?.trim();
  if (cookieValue) {
    localStorage.setItem(STORAGE_KEY, cookieValue);
    return cookieValue;
  }

  const storageValue = localStorage.getItem(STORAGE_KEY)?.trim();
  if (storageValue) {
    writeCookie(COOKIE_NAME, storageValue);
    return storageValue;
  }

  const created = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, created);
  writeCookie(COOKIE_NAME, created);
  return created;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const anonId = getClientAnonId();
  const headers = new Headers(init.headers);
  if (anonId) headers.set("x-ff-uid", anonId);

  return fetch(input, {
    ...init,
    headers,
    credentials: "same-origin"
  });
}
