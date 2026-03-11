import { NextResponse, type NextRequest } from "next/server";
import PdfPrinter from "pdfmake";
import vfsFonts from "pdfmake/build/vfs_fonts";
import { getSupabaseAdmin } from "@/src/server/supabaseAdmin";
import { jsonError } from "@/src/app/api/_util";

export const runtime = "nodejs";

function isMissingMainInsightColumn(message?: string | null) {
  return Boolean(message && message.includes("main_insight") && message.includes("schema cache"));
}

const CJM_STAGE_RU: Record<string, string> = {
  Acquisition: "Привлечение",
  Onboarding: "Онбординг",
  Activation: "Активация",
  "Core Use": "Основное использование",
  Billing: "Оплата",
  Retention: "Удержание",
  Support: "Поддержка",
  Other: "Другое"
};

const SEVERITY_RU: Record<string, string> = {
  low: "низкая",
  medium: "средняя",
  high: "высокая"
};

const IMPACT_RU: Record<string, string> = {
  low: "низкий",
  medium: "средний",
  high: "высокий"
};

const CONFIDENCE_RU: Record<string, string> = {
  low: "низкая",
  medium: "средняя",
  high: "высокая"
};

function getPdfBytes(docDefinition: any): Promise<Uint8Array> {
  const vfs = (vfsFonts as any).pdfMake?.vfs ?? (vfsFonts as any).vfs;
  const getFont = (name: string) => Buffer.from(vfs[name], "base64");

  const fonts = {
    Roboto: {
      normal: getFont("Roboto-Regular.ttf"),
      bold: getFont("Roboto-Medium.ttf"),
      italics: getFont("Roboto-Italic.ttf"),
      bolditalics: getFont("Roboto-MediumItalic.ttf")
    }
  };

  const printer = new (PdfPrinter as any)(fonts);
  const pdfDoc = printer.createPdfKitDocument(docDefinition, {});

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on("data", (c: Buffer) => chunks.push(c));
    pdfDoc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const supabase = getSupabaseAdmin();

    let analysis = await supabase
      .from("analyses")
      .select("id, created_at, user_id, input_items, main_insight")
      .eq("id", id)
      .single();
    if (analysis.error && isMissingMainInsightColumn(analysis.error.message)) {
      analysis = await supabase.from("analyses").select("id, created_at, user_id, input_items").eq("id", id).single();
    }
    if (analysis.error) return jsonError("Анализ не найден.", 404);
    const a = analysis.data as unknown as {
      id?: string;
      created_at?: string;
      input_items?: unknown;
      main_insight?: string | null;
    };
    if (!a?.id || !a.created_at) return jsonError("Анализ не найден.", 404);

    const itemsCount = Array.isArray(a.input_items) ? a.input_items.length : 0;

    const painPoints = await supabase
      .from("pain_points")
      .select("title, summary, evidence_count, cjm_stage, severity")
      .eq("analysis_id", id)
      .order("evidence_count", { ascending: false });
    if (painPoints.error) return jsonError(`DB error: ${painPoints.error.message}`, 500);

    const hypotheses = await supabase
      .from("hypotheses")
      .select("title, hypothesis, expected_impact, confidence, status")
      .eq("analysis_id", id)
      .order("created_at", { ascending: true });
    if (hypotheses.error) return jsonError(`DB error: ${hypotheses.error.message}`, 500);

    const createdAt = new Date(a.created_at);
    const dateRu = createdAt.toLocaleString("ru-RU");

    const docDefinition = {
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: "Roboto", fontSize: 11 },
      content: [
        { text: "Отчет анализа пользовательских отзывов", style: "title" },
        { text: `Дата анализа: ${dateRu}`, margin: [0, 6, 0, 0] },
        { text: `Проанализировано отзывов: ${itemsCount}`, margin: [0, 2, 0, 10] },

        a.main_insight
          ? { text: "Главный инсайт", style: "h2" }
          : { text: "", margin: [0, 0, 0, 0] },
        a.main_insight ? { text: a.main_insight, margin: [0, 4, 0, 10] } : { text: "", margin: [0, 0, 0, 0] },

        { text: "Проблемы пользователей", style: "h2" },
        ...(painPoints.data ?? []).flatMap((p: any, idx: number) => {
          const stage = CJM_STAGE_RU[p.cjm_stage] ?? String(p.cjm_stage ?? "");
          const sev = SEVERITY_RU[p.severity] ?? String(p.severity ?? "");
          return [
            { text: `${idx + 1}. ${p.title}`, style: "h3", margin: [0, 8, 0, 0] },
            { text: `Упоминаний: ${p.evidence_count ?? 0}`, margin: [0, 2, 0, 0] },
            { text: `Этап CJM: ${stage}`, margin: [0, 2, 0, 0] },
            { text: `Серьёзность: ${sev}`, margin: [0, 2, 0, 0] },
            p.summary ? { text: p.summary, margin: [0, 4, 0, 0], color: "#555555" } : { text: "" }
          ];
        }),

        { text: "Продуктовые гипотезы", style: "h2", margin: [0, 14, 0, 0] },
        ...(hypotheses.data ?? []).map((h: any, idx: number) => {
          const impact = IMPACT_RU[h.expected_impact] ?? String(h.expected_impact ?? "");
          const conf = CONFIDENCE_RU[h.confidence] ?? String(h.confidence ?? "");
          return {
            stack: [
              { text: `${idx + 1}. ${h.title}`, style: "h3", margin: [0, 8, 0, 0] },
              { text: h.hypothesis ?? "", margin: [0, 2, 0, 0] },
              { text: `Эффект: ${impact}`, margin: [0, 2, 0, 0] },
              { text: `Уверенность: ${conf}`, margin: [0, 2, 0, 0] }
            ]
          };
        })
      ],
      styles: {
        title: { fontSize: 18, bold: true },
        h2: { fontSize: 14, bold: true, margin: [0, 10, 0, 0] },
        h3: { fontSize: 12, bold: true }
      }
    };

    const pdf = await getPdfBytes(docDefinition);
    const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    const filename = `feedfocus-report-${id}.pdf`;
    return new NextResponse(body, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Internal error.", 500);
  }
}
