import { NextResponse } from "next/server";
import { getEnv } from "@/src/server/env";
import { getSupabaseAdmin } from "@/src/server/supabaseAdmin";

export async function GET() {
  try {
    // env validation
    const env = getEnv();

    // REST reachability (network/DNS)
    try {
      const rest = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY }
      });
      if (!rest.ok) {
        return NextResponse.json(
          { status: "error", reason: `supabase rest: ${rest.status} ${rest.statusText}` },
          { status: 500 }
        );
      }
    } catch (e) {
      const reason =
        e instanceof Error
          ? `${e.name}: ${e.message}${(e as any).cause ? ` (cause: ${(e as any).cause})` : ""}`
          : "supabase rest: fetch failed";
      return NextResponse.json({ status: "error", reason }, { status: 500 });
    }

    // supabase connectivity + schema presence (minimal)
    const supabase = getSupabaseAdmin();
    const res = await supabase.from("users").select("id", { head: true, count: "exact" }).limit(1);
    if (res.error) {
      return NextResponse.json({ status: "error", reason: `supabase: ${res.error.message}` }, { status: 500 });
    }

    return NextResponse.json({ status: "ok" });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ status: "error", reason }, { status: 500 });
  }
}
