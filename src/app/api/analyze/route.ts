import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/server/auth";
import { getEnv } from "@/src/server/env";
import { getSupabaseAdmin } from "@/src/server/supabaseAdmin";
import { parseFeedbackItems } from "@/src/server/feedback";
import { analyzeFeedback } from "@/src/server/analyzeFeedback";
import { jsonError } from "@/src/app/api/_util";

const bodySchema = z.object({
  raw: z.string().min(1)
});

function formatErrorDetails(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as any).cause;
  const causePart =
    cause && typeof cause === "object"
      ? `; cause=${(cause as any).code ?? (cause as any).name ?? "unknown"}:${(cause as any).message ?? String(cause)}`
      : cause
        ? `; cause=${String(cause)}`
        : "";
  return `${err.name}: ${err.message}${causePart}`;
}

export async function POST(req: NextRequest) {
  const env = getEnv();
  try {
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();

    // Retention purge (best-effort)
    const cutoff = new Date(Date.now() - env.RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const purge = await supabase.from("analyses").delete().lt("created_at", cutoff);
    if (purge.error) return jsonError(`DB error: ${purge.error.message}`, 500);

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch (e) {
      return jsonError("Invalid JSON body.", 400);
    }

    const parsedBody = bodySchema.safeParse(bodyJson);
    if (!parsedBody.success) return jsonError("Введите фидбек текстом.", 400);

    const items = parseFeedbackItems(parsedBody.data.raw);
    if (items.length === 0) return jsonError("Введите фидбек текстом.", 400);
    if (items.length > env.MAX_FEEDBACK_ITEMS) {
      return jsonError(`Слишком много отзывов. Максимум: ${env.MAX_FEEDBACK_ITEMS}.`, 400);
    }

    // Daily limit
    const startOfDayUtc = new Date();
    startOfDayUtc.setUTCHours(0, 0, 0, 0);
    const countRes = await supabase
      .from("analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.userId)
      .gte("created_at", startOfDayUtc.toISOString());
    if (countRes.error) return jsonError(`DB error: ${countRes.error.message}`, 500);

    const used = countRes.count ?? 0;
    if (used >= env.DAILY_ANALYZE_LIMIT) {
      return jsonError("Вы достигли дневного лимита анализов. Попробуйте снова завтра.", 429);
    }

    await supabase.from("events").insert({ user_id: user.userId, name: "analysis_created", meta: { items: items.length } });

    let result: Awaited<ReturnType<typeof analyzeFeedback>>;
    try {
      result = await analyzeFeedback(items);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.startsWith("LLM response invalid")) {
        return jsonError("LLM response invalid", 502);
      }
      throw e;
    }

    const analysisIns = await supabase
      .from("analyses")
      .insert({
        user_id: user.userId,
        input_raw: parsedBody.data.raw,
        input_items: items,
        main_insight: result.mainInsight,
        model: result.model,
        status: "completed",
        completed_at: new Date().toISOString()
      })
      .select("id, created_at")
      .single();

    if (analysisIns.error) return jsonError(`DB error: ${analysisIns.error.message}`, 500);

    const analysisId = analysisIns.data.id as string;

    const painPointRows = result.painPoints.map((p) => ({
      analysis_id: analysisId,
      llm_key: p.llmKey,
      title: p.title,
      summary: p.summary,
      evidence_count: p.evidenceCount,
      quotes: p.quotes,
      cjm_stage: p.cjmStage,
      severity: p.severity,
      confidence: p.confidence
    }));

    const painIns = await supabase.from("pain_points").insert(painPointRows).select("id, llm_key");
    if (painIns.error) return jsonError(`DB error: ${painIns.error.message}`, 500);

    const keyToId = new Map<string, string>();
    for (const row of painIns.data ?? []) {
      if (row.llm_key) keyToId.set(row.llm_key as string, row.id as string);
    }

    const hypothesisRows = result.hypotheses
      .map((h) => {
        const painPointId = keyToId.get(h.relatedPainPointKey);
        if (!painPointId) return null;
        return {
          analysis_id: analysisId,
          pain_point_id: painPointId,
          title: h.title,
          hypothesis: h.hypothesis,
          expected_impact: h.expectedImpact,
          confidence: h.confidence,
          status: h.status
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    if (hypothesisRows.length > 0) {
      const hypIns = await supabase.from("hypotheses").insert(hypothesisRows);
      if (hypIns.error) return jsonError(`DB error: ${hypIns.error.message}`, 500);
    }

    await supabase.from("events").insert({
      user_id: user.userId,
      name: "analysis_completed",
      meta: { analysis_id: analysisId, pain_points: painPointRows.length, hypotheses: hypothesisRows.length }
    });

    return NextResponse.json({ analysisId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error.";
    const status = typeof (e as any)?.status === "number" ? ((e as any).status as number) : null;
    if (msg.startsWith("Unauthorized:")) {
      return jsonError(msg, 401);
    }
    if (status === 401 || status === 403) {
      return jsonError("LLM auth failed (check API key)", 502);
    }
    if (status === 429 || msg.includes("rate limit") || msg.includes("quota")) {
      return jsonError("LLM rate limit/quota exceeded", 502);
    }
    const details = formatErrorDetails(e);
    console.error("ANALYZE ERROR:", details);
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({ message: "Analyze failed", details }, { status: 500 });
    }
    return jsonError(msg, 500);
  }
}
