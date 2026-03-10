import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/src/server/auth";
import { getSupabaseAdmin } from "@/src/server/supabaseAdmin";
import { jsonError } from "@/src/app/api/_util";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();

    const analyses = await supabase
      .from("analyses")
      .select("id, created_at")
      .eq("user_id", user.userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (analyses.error) return jsonError(`DB error: ${analyses.error.message}`, 500);

    const ids = (analyses.data ?? []).map((a) => a.id as string);
    const painCounts = new Map<string, number>();
    const hypCounts = new Map<string, number>();

    if (ids.length > 0) {
      const pains = await supabase.from("pain_points").select("analysis_id").in("analysis_id", ids);
      if (pains.error) return jsonError(`DB error: ${pains.error.message}`, 500);
      for (const r of pains.data ?? []) {
        const key = r.analysis_id as string;
        painCounts.set(key, (painCounts.get(key) ?? 0) + 1);
      }

      const hyps = await supabase.from("hypotheses").select("analysis_id").in("analysis_id", ids);
      if (hyps.error) return jsonError(`DB error: ${hyps.error.message}`, 500);
      for (const r of hyps.data ?? []) {
        const key = r.analysis_id as string;
        hypCounts.set(key, (hypCounts.get(key) ?? 0) + 1);
      }
    }

    const items = (analyses.data ?? []).map((a) => ({
      id: a.id as string,
      createdAt: a.created_at as string,
      painPointsCount: painCounts.get(a.id as string) ?? 0,
      hypothesesCount: hypCounts.get(a.id as string) ?? 0
    }));

    return NextResponse.json({ items });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Unauthorized.", 401);
  }
}
