import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/src/server/supabaseAdmin";
import { jsonError } from "@/src/app/api/_util";

function isMissingMainInsightColumn(message?: string | null) {
  return Boolean(message && message.includes("main_insight") && message.includes("schema cache"));
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const supabase = getSupabaseAdmin();

    let analysis = await supabase
      .from("analyses")
      .select("id, created_at, user_id, main_insight")
      .eq("id", id)
      .single();
    if (analysis.error && isMissingMainInsightColumn(analysis.error.message)) {
      analysis = await supabase.from("analyses").select("id, created_at, user_id").eq("id", id).single();
    }
    if (analysis.error) return jsonError("Анализ не найден.", 404);
    const analysisData = analysis.data as unknown as {
      id?: string;
      created_at?: string;
      main_insight?: string | null;
    };
    if (!analysisData?.id || !analysisData.created_at) return jsonError("Анализ не найден.", 404);

    const painPoints = await supabase
      .from("pain_points")
      .select("id, title, summary, evidence_count, quotes, cjm_stage, severity, confidence")
      .eq("analysis_id", id)
      .order("created_at", { ascending: true });
    if (painPoints.error) return jsonError(`DB error: ${painPoints.error.message}`, 500);

    const hypotheses = await supabase
      .from("hypotheses")
      .select("id, pain_point_id, title, hypothesis, expected_impact, confidence, status")
      .eq("analysis_id", id)
      .order("created_at", { ascending: true });
    if (hypotheses.error) return jsonError(`DB error: ${hypotheses.error.message}`, 500);

    return NextResponse.json({
      analysis: { id: analysisData.id, createdAt: analysisData.created_at, mainInsight: analysisData.main_insight ?? null },
      painPoints: (painPoints.data ?? []).map((p) => ({
        id: p.id as string,
        title: p.title as string,
        summary: p.summary as string,
        evidenceCount: p.evidence_count as number,
        quotes: Array.isArray(p.quotes) ? (p.quotes as unknown as string[]) : [],
        cjmStage: p.cjm_stage as string,
        severity: p.severity as string,
        confidence: p.confidence as string
      })),
      hypotheses: (hypotheses.data ?? []).map((h) => ({
        id: h.id as string,
        painPointId: h.pain_point_id as string,
        title: h.title as string,
        hypothesis: h.hypothesis as string,
        expectedImpact: h.expected_impact as string,
        confidence: h.confidence as string,
        status: h.status as string
      }))
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Internal error.", 500);
  }
}
