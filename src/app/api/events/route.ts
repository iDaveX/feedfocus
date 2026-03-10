import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/server/auth";
import { getSupabaseAdmin } from "@/src/server/supabaseAdmin";
import { jsonError } from "@/src/app/api/_util";

const bodySchema = z.object({
  name: z.string().min(1),
  meta: z.record(z.unknown()).default({})
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = bodySchema.safeParse(await req.json());
    if (!body.success) return jsonError("Invalid event payload.", 400);

    const supabase = getSupabaseAdmin();
    const ins = await supabase.from("events").insert({
      user_id: user.userId,
      name: body.data.name,
      meta: body.data.meta
    });
    if (ins.error) return jsonError(`DB error: ${ins.error.message}`, 500);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Unauthorized.", 401);
  }
}

