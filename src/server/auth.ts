import type { NextRequest } from "next/server";
import { getEnv } from "@/src/server/env";
import { getSupabaseAdmin } from "@/src/server/supabaseAdmin";
import { verifyTelegramInitData } from "@/src/server/telegramAuth";

export type AuthedUser = {
  userId: string; // internal uuid
  telegramUserId: number;
};

export async function requireUser(req: NextRequest): Promise<AuthedUser> {
  const env = getEnv();
  const initData = req.headers.get("x-telegram-init-data");

  let telegramUserId: number | null = null;
  if (initData && initData.trim().length > 0) {
    if (!env.TELEGRAM_BOT_TOKEN) {
      throw Object.assign(new Error("Unauthorized: TELEGRAM_BOT_TOKEN is not configured."), { status: 401 });
    }
    try {
      const tgUser = verifyTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN);
      telegramUserId = tgUser.id;
    } catch (e) {
      throw Object.assign(new Error("Unauthorized: invalid Telegram initData."), { status: 401, cause: e });
    }
  } else if (
    env.DEV_TELEGRAM_USER_ID &&
    env.DEV_TELEGRAM_USER_ID.trim().length > 0
  ) {
    // Dev/demo fallback:
    // - Always allowed in development
    // - Allowed in production only if Telegram auth is not configured
    if (process.env.NODE_ENV === "development" || !env.TELEGRAM_BOT_TOKEN) {
      telegramUserId = Number(env.DEV_TELEGRAM_USER_ID);
    }
  }

  if (!telegramUserId || !Number.isFinite(telegramUserId)) {
    throw Object.assign(new Error("Unauthorized: missing Telegram initData."), { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const upsert = await supabase
    .from("users")
    .upsert({ telegram_user_id: telegramUserId }, { onConflict: "telegram_user_id" })
    .select("id, telegram_user_id")
    .single();

  if (upsert.error) throw new Error(`DB error: ${upsert.error.message}`);
  return { userId: upsert.data.id as string, telegramUserId: upsert.data.telegram_user_id as number };
}
