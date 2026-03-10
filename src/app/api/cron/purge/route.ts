import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/src/server/env";
import { getSupabaseAdmin } from "@/src/server/supabaseAdmin";
import { jsonError } from "@/src/app/api/_util";

export async function GET(req: NextRequest) {
  const env = getEnv();
  if (env.CRON_SECRET) {
    const headerSecret = req.headers.get("x-cron-secret");
    const url = new URL(req.url);
    const querySecret = url.searchParams.get("secret");
    const secret = headerSecret ?? querySecret;
    if (!secret || secret !== env.CRON_SECRET) return jsonError("Forbidden.", 403);
  } else {
    // If not configured, keep this endpoint closed by default.
    return jsonError("Cron is not configured.", 400);
  }

  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - env.RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const del = await supabase.from("analyses").delete().lt("created_at", cutoff);
  if (del.error) return jsonError(`DB error: ${del.error.message}`, 500);
  return NextResponse.json({ ok: true });
}
