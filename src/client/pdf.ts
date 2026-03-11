"use client";

import type { AnalysisDetails } from "@/src/shared/api";

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

const PRIORITY_RU: Record<string, string> = {
  low: "низкая",
  medium: "средняя",
  high: "высокая"
};

const IMPACT_RU: Record<string, string> = {
  low: "низкий",
  medium: "средний",
  high: "высокий"
};

const STATUS_RU: Record<string, string> = {
  new: "новая",
  testing: "тестируется",
  validated: "подтверждена",
  rejected: "отклонена"
};

async function getPdfMake() {
  const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts")
  ]);

  const vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).vfs;
  (pdfMake as any).vfs = vfs;
  return pdfMake as any;
}

export async function downloadAnalysisReportPdf(data: AnalysisDetails, filename: string) {
  const pdfMake = await getPdfMake();
  const dateRu = new Date(data.analysis.createdAt).toLocaleString("ru-RU");
  const docDefinition = {
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { font: "Roboto", fontSize: 11 },
    content: [
      { text: "Отчет анализа пользовательских отзывов", style: "title" },
      { text: `Дата анализа: ${dateRu}`, margin: [0, 6, 0, 0] },
      { text: `Проанализировано отзывов: ${data.painPoints.reduce((sum, item) => sum + item.evidenceCount, 0)}`, margin: [0, 2, 0, 10] },
      data.analysis.mainInsight ? { text: "Главный инсайт", style: "h2" } : { text: "" },
      data.analysis.mainInsight ? { text: data.analysis.mainInsight, margin: [0, 4, 0, 10] } : { text: "" },
      { text: "Проблемы пользователей", style: "h2" },
      ...data.painPoints.flatMap((p, idx) => [
        { text: `${idx + 1}. ${p.title}`, style: "h3", margin: [0, 8, 0, 0] },
        { text: `Упоминаний: ${p.evidenceCount}`, margin: [0, 2, 0, 0] },
        { text: `Этап CJM: ${CJM_STAGE_RU[p.cjmStage] ?? p.cjmStage}`, margin: [0, 2, 0, 0] },
        { text: `Приоритет: ${PRIORITY_RU[p.severity] ?? p.severity}`, margin: [0, 2, 0, 0] },
        { text: p.summary, margin: [0, 4, 0, 0], color: "#555555" }
      ]),
      { text: "Продуктовые гипотезы", style: "h2", margin: [0, 14, 0, 0] },
      ...data.hypotheses.map((h, idx) => ({
        stack: [
          { text: `${idx + 1}. ${h.title}`, style: "h3", margin: [0, 8, 0, 0] },
          { text: h.hypothesis, margin: [0, 2, 0, 0] },
          { text: `Проблема: ${data.painPoints.find((p) => p.id === h.painPointId)?.title ?? "—"}`, margin: [0, 2, 0, 0] },
          { text: `Эффект: ${IMPACT_RU[h.expectedImpact] ?? h.expectedImpact}`, margin: [0, 2, 0, 0] },
          { text: `Статус: ${STATUS_RU[h.status] ?? h.status}`, margin: [0, 2, 0, 0] }
        ]
      }))
    ],
    styles: {
      title: { fontSize: 18, bold: true },
      h2: { fontSize: 14, bold: true, margin: [0, 10, 0, 0] },
      h3: { fontSize: 12, bold: true }
    }
  };

  pdfMake.createPdf(docDefinition).download(filename);
}

export async function downloadHypothesesPdf(data: AnalysisDetails, filename: string) {
  const pdfMake = await getPdfMake();
  const dateRu = new Date(data.analysis.createdAt).toLocaleString("ru-RU");
  const painPointById = new Map(data.painPoints.map((p) => [p.id, p.title]));
  const docDefinition = {
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { font: "Roboto", fontSize: 11 },
    content: [
      { text: "Продуктовые гипотезы", style: "title" },
      { text: `Дата анализа: ${dateRu}`, margin: [0, 6, 0, 0] },
      { text: `Всего гипотез: ${data.hypotheses.length}`, margin: [0, 2, 0, 10] },
      ...data.hypotheses.map((h, idx) => ({
        stack: [
          { text: `${idx + 1}. ${h.title}`, style: "h3", margin: [0, 10, 0, 0] },
          { text: h.hypothesis, margin: [0, 2, 0, 0] },
          { text: `Проблема: ${painPointById.get(h.painPointId) ?? "—"}`, margin: [0, 2, 0, 0] },
          { text: `Эффект: ${IMPACT_RU[h.expectedImpact] ?? h.expectedImpact}`, margin: [0, 2, 0, 0] },
          { text: `Статус: ${STATUS_RU[h.status] ?? h.status}`, margin: [0, 2, 0, 0] }
        ]
      }))
    ],
    styles: {
      title: { fontSize: 18, bold: true },
      h3: { fontSize: 12, bold: true }
    }
  };

  pdfMake.createPdf(docDefinition).download(filename);
}
