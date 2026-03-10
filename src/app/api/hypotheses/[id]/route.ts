import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/server/auth";
import { getSupabaseAdmin } from "@/src/server/supabaseAdmin";
import { jsonError } from "@/src/app/api/_util";

const bodySchema = z.object({
  status: z.enum(["new", "testing", "validated", "rejected"])
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const body = bodySchema.safeParse(await req.json());
    if (!body.success) return jsonError("Invalid status.", 400);

    const supabase = getSupabaseAdmin();

    const hyp = await supabase
      .from("hypotheses")
      .select("id, analysis_id")
      .eq("id", id)
      .single();
    if (hyp.error) return jsonError("Hypothesis не найдена.", 404);

    const hypData = hyp.data as unknown as { analysis_id?: string };
    if (!hypData?.analysis_id) return jsonError("Hypothesis не найдена.", 404);

    const analysis = await supabase.from("analyses").select("id, user_id").eq("id", hypData.analysis_id).single();
    if (analysis.error) return jsonError("Анализ не найден.", 404);
    const analysisData = analysis.data as unknown as { user_id?: string };
    if (!analysisData?.user_id) return jsonError("Анализ не найден.", 404);
    if (analysisData.user_id !== user.userId) return jsonError("Forbidden.", 403);

    const upd = await supabase.from("hypotheses").update({ status: body.data.status }).eq("id", id);
    if (upd.error) return jsonError(`DB error: ${upd.error.message}`, 500);

    await supabase.from("events").insert({
      user_id: user.userId,
      name: "hypothesis_status_changed",
      meta: { hypothesis_id: id, status: body.data.status }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Unauthorized.", 401);
  }
}
