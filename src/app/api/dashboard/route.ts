import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/src/server/auth";
import { getSupabaseAdmin } from "@/src/server/supabaseAdmin";
import { jsonError } from "@/src/app/api/_util";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();

    const analysesRes = await supabase.from("analyses").select("id").eq("user_id", user.userId);
    if (analysesRes.error) return jsonError(`DB error: ${analysesRes.error.message}`, 500);
    const analysisIds = (analysesRes.data ?? []).map((x) => x.id as string);

    const painRes =
      analysisIds.length === 0
        ? { data: [] as Array<{ cjm_stage: string }>, error: null as { message: string } | null }
        : await supabase.from("pain_points").select("cjm_stage").in("analysis_id", analysisIds);
    if (painRes.error) return jsonError(`DB error: ${painRes.error.message}`, 500);

    const hypRes =
      analysisIds.length === 0
        ? { data: [] as Array<{ status: string }>, error: null as { message: string } | null }
        : await supabase.from("hypotheses").select("status").in("analysis_id", analysisIds);
    if (hypRes.error) return jsonError(`DB error: ${hypRes.error.message}`, 500);

    const painPointsDetected = painRes.data.length;
    const hypothesesGenerated = hypRes.data.length;

    const stageCounts = new Map<string, number>();
    for (const p of painRes.data) stageCounts.set(p.cjm_stage, (stageCounts.get(p.cjm_stage) ?? 0) + 1);
    const topCjmStages = Array.from(stageCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([stage, count]) => ({ stage, share: painPointsDetected === 0 ? 0 : count / painPointsDetected }));

    const statusCounts = new Map<string, number>([
      ["new", 0],
      ["testing", 0],
      ["validated", 0],
      ["rejected", 0]
    ]);
    for (const h of hypRes.data) statusCounts.set(h.status, (statusCounts.get(h.status) ?? 0) + 1);

    return NextResponse.json({
      kpi: {
        analysesPerformed: analysisIds.length,
        painPointsDetected,
        hypothesesGenerated
      },
      topCjmStages,
      hypothesisStatus: Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count }))
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Unauthorized.", 401);
  }
}
