import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import { getEnv } from "@/src/server/env";
import { getSupabaseAdmin } from "@/src/server/supabaseAdmin";

export type AuthedUser = {
  userId: string; // internal uuid
  anonId: string;
};

export async function requireUser(req: NextRequest): Promise<AuthedUser> {
  const env = getEnv();
  const cookieId = req.cookies.get("ff_uid")?.value?.trim();
  const anonId = env.DEV_USER_ID?.trim() || cookieId || crypto.randomUUID();

  const supabase = getSupabaseAdmin();
  const upsert = await supabase
    .from("users")
    .upsert({ anon_id: anonId }, { onConflict: "anon_id" })
    .select("id, anon_id")
    .single();

  if (upsert.error) throw new Error(`DB error: ${upsert.error.message}`);
  return { userId: upsert.data.id as string, anonId: upsert.data.anon_id as string };
}
