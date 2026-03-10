import crypto from "node:crypto";

export type TelegramWebAppUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

export function verifyTelegramInitData(initData: string, botToken: string, maxAgeSeconds = 60 * 60 * 24) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("Missing initData hash.");

  const authDateStr = params.get("auth_date");
  if (!authDateStr) throw new Error("Missing auth_date.");
  const authDate = Number(authDateStr);
  if (!Number.isFinite(authDate)) throw new Error("Invalid auth_date.");
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - authDate > maxAgeSeconds) throw new Error("initData is too old.");

  const dataCheckPairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    dataCheckPairs.push(`${key}=${value}`);
  }
  dataCheckPairs.sort((a, b) => a.localeCompare(b));
  const dataCheckString = dataCheckPairs.join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Invalid initData signature.");
  }

  const userStr = params.get("user");
  if (!userStr) throw new Error("Missing user payload.");
  const user = JSON.parse(userStr) as TelegramWebAppUser;
  if (!user?.id) throw new Error("Invalid user payload.");
  return user;
}

