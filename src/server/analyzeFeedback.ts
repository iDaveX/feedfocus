import { z } from "zod";
import { getEnv } from "@/src/server/env";
import { getOpenAI } from "@/src/server/openaiClient";

const CJM_STAGES = [
  "Acquisition",
  "Onboarding",
  "Activation",
  "Core Use",
  "Billing",
  "Retention",
  "Support",
  "Other"
] as const;

const severitySchema = z.enum(["low", "medium", "high"]);
const confidenceSchema = z.enum(["low", "medium", "high"]);
const impactSchema = z.enum(["low", "medium", "high"]);
const statusSchema = z.enum(["new", "testing", "validated", "rejected"]);

const llmPainPointSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  cjm_stage: z.enum(CJM_STAGES),
  severity: severitySchema,
  confidence: confidenceSchema,
  evidence_indices: z.array(z.number().int().nonnegative()).min(1)
});

const llmHypothesisSchema = z.object({
  title: z.string().min(1),
  hypothesis: z.string().min(1),
  related_pain_point_key: z.string().min(1),
  expected_impact: impactSchema,
  confidence: confidenceSchema,
  status: statusSchema
});

const llmResultSchema = z.object({
  main_insight: z.string().min(1).max(220),
  pain_points: z.array(llmPainPointSchema).max(20),
  hypotheses: z.array(llmHypothesisSchema).max(60)
});

export type AnalyzedPainPoint = {
  llmKey: string;
  title: string;
  summary: string;
  evidenceCount: number;
  quotes: string[];
  cjmStage: (typeof CJM_STAGES)[number];
  severity: z.infer<typeof severitySchema>;
  confidence: z.infer<typeof confidenceSchema>;
};

export type AnalyzedHypothesis = {
  title: string;
  hypothesis: string;
  relatedPainPointKey: string;
  expectedImpact: z.infer<typeof impactSchema>;
  confidence: z.infer<typeof confidenceSchema>;
  status: z.infer<typeof statusSchema>;
};

function llmInvalid(reason: string): never {
  throw new Error(`LLM response invalid${reason ? `: ${reason}` : ""}`);
}

export async function analyzeFeedback(items: string[]) {
  const env = getEnv();
  const openai = getOpenAI();
  const model = env.LLM_PROVIDER === "groq" ? env.GROQ_MODEL : env.OPENAI_MODEL;

  const numbered = items.map((t, i) => `[${i}] ${t}`).join("\n");

  const toolName = "submit_analysis";
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Ты ассистент для продакт-анализа пользовательского фидбека на русском языке. " +
          "Твоя задача — выделять только реальные pain points, кластеризовать их, разнести по этапам CJM, " +
          "и предложить продуктовые гипотезы. " +
          "Ключевое требование: объединяй похожие/дублирующиеся формулировки в один pain point и агрегируй доказательства. " +
          "Формулировки pain points должны быть краткими, обобщёнными и без лишних уточнений. " +
          "Гипотезы должны звучать как продуктовые гипотезы для PM: конкретно, делово, с понятным изменением и ожидаемым эффектом. " +
          "Важно: не выдумывай факты и не добавляй цитаты, которых нет во входных данных. " +
          "Важно: не путай негативный тон с проблемой и не считай похвалу проблемой. " +
          "Если во входе нет повторяющихся или достаточно явных проблем, можно вернуть пустой список pain_points и пустой список hypotheses. " +
          "Не создавай pain point только потому, что отзыв эмоциональный, смешанный или содержит общую оценку. " +
          "Не придумывай точные проценты роста или падения, если таких данных нет во входе. " +
          "Все тексты (title/summary/hypothesis) пиши на русском языке. " +
          "Выход должен быть строго структурированным, через вызов функции."
      },
      {
        role: "user",
        content:
          "Входные отзывы (каждая строка — отдельный отзыв с индексом):\n" +
          numbered +
          "\n\nСформируй:\n" +
          "0) main_insight: ровно 1 короткое предложение, максимум 160 символов. " +
          "Это должен быть вывод для PM, а не абзац. " +
          "Формат: [главная проблема] + [где/когда проявляется] + [почему это важно]. " +
          "Если уместно, можно добавить приблизительную долю в %, но только одну. " +
          "Если явных проблем не найдено, main_insight должен честно сказать, что в выборке преобладают нейтральные или позитивные отзывы и подтверждённых pain points не выявлено.\n" +
          "1) pain_points[]: каждый pain point должен иметь key (например pp_1), title, summary, cjm_stage, severity, confidence,\n" +
          "   и evidence_indices[] — список индексов отзывов, где встречается проблема. " +
          "   Допускается пустой массив pain_points, если проблемный сигнал слабый, единичный или отсутствует.\n" +
          "2) hypotheses[]: гипотезы в формате: 'Если [изменение], то [метрика/поведение] [вырастет/снизится/улучшится], потому что [обоснование]'.\n" +
          "   Каждая гипотеза должна ссылаться на pain point через related_pain_point_key. " +
          "   Если pain_points пустой, hypotheses тоже должен быть пустым.\n\n" +
          "Правила дедупликации (обязательно):\n" +
          "- Не создавай несколько pain points для одной и той же проблемы.\n" +
          "- Если несколько формулировок описывают одно и то же — выбери более общий pain point (короткий title).\n" +
          "- Увеличивай evidence_indices (и тем самым evidence_count в продукте), объединяя все подтверждающие отзывы.\n" +
          "- Избегай уточнений вида 'для новых пользователей', если они не создают отдельную проблему.\n\n" +
          "Правила выделения проблем:\n" +
          "- Считай pain point только конкретную жалобу, барьер, сбой, обман, неудобство или повторяющийся негативный опыт.\n" +
          "- Не считай pain point просто похвалу, нейтральный факт, общий эмоциональный отзыв без сути или единичное слабое недовольство без внятной проблемы.\n" +
          "- Смешанный отзыв с похвалой и жалобой можно считать pain point только если жалоба конкретная и важная.\n\n" +
          "Требования к формулировкам:\n" +
          "- title: 2–4 слова, максимально обобщённо (пример: 'Сложный интерфейс', 'Медленная поддержка').\n" +
          "- summary: 1–2 предложения, по делу, без воды.\n\n" +
          "Требования к main_insight:\n" +
          "- Только 1 предложение.\n" +
          "- Без перечисления всех проблем через запятую.\n" +
          "- Сфокусируйся на одном главном выводе.\n" +
          "- Пиши коротко, как тезис для слайда.\n\n" +
          "Требования к гипотезам:\n" +
          "- Пиши как PM, а не как общий совет.\n" +
          "- Используй наблюдаемую метрику или поведение: конверсия в регистрацию, завершение онбординга, успешный вход, число обращений в поддержку, доля успешных оплат, удержание, время до первого действия.\n" +
          "- Избегай абстракций вроде 'станет лучше' или 'пользователи будут довольны', если можно назвать более конкретный эффект.\n" +
          "- Не выдумывай точные числа вроде '+5%' или '-12%', если во входе нет базы для такой оценки.\n" +
          "- Если точную метрику назвать сложно, используй мягкую формулировку: 'снизится число жалоб', 'вырастет доля завершения', 'сократится время до первого действия'.\n" +
          "- Делай 1 изменение = 1 ожидаемый эффект.\n" +
          "- title гипотезы должен быть коротким и деловым, например: 'Сократить время открытия', 'Упростить навигацию', 'Сократить шаги регистрации'.\n\n" +
          "Примеры хороших гипотез:\n" +
          "- Если сократить время открытия приложения, то вырастет доля пользователей, которые доходят до первого целевого действия, потому что сейчас часть пользователей сталкивается с долгой загрузкой и уходит.\n" +
          "- Если сократить количество шагов в регистрации, то вырастет конверсия в завершение онбординга, потому что пользователи жалуются на сложный старт.\n" +
          "- Если сделать тарифы и управление подпиской заметнее, то снизится число обращений в поддержку по оплате, потому что пользователи не могут быстро найти нужный раздел.\n\n" +
          "Ограничения:\n" +
          "- CJM стадии только из списка: " +
          CJM_STAGES.join(", ") +
          ".\n" +
          "- Не больше 12 pain points.\n" +
          "- Если pain point найден, обычно давай 1–2 гипотезы на pain point.\n" +
          "- status для новых гипотез всегда 'new'."
      }
    ],
    tools: [
      {
        type: "function",
        function: {
          name: toolName,
          description: "Структурированный результат анализа фидбека",
          parameters: {
            type: "object",
            additionalProperties: false,
            properties: {
              main_insight: { type: "string" },
              pain_points: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    key: { type: "string" },
                    title: { type: "string" },
                    summary: { type: "string" },
                    cjm_stage: { type: "string", enum: [...CJM_STAGES] },
                    severity: { type: "string", enum: ["low", "medium", "high"] },
                    confidence: { type: "string", enum: ["low", "medium", "high"] },
                    evidence_indices: { type: "array", items: { type: "integer", minimum: 0 } }
                  },
                  required: ["key", "title", "summary", "cjm_stage", "severity", "confidence", "evidence_indices"]
                }
              },
              hypotheses: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    hypothesis: { type: "string" },
                    related_pain_point_key: { type: "string" },
                    expected_impact: { type: "string", enum: ["low", "medium", "high"] },
                    confidence: { type: "string", enum: ["low", "medium", "high"] },
                    status: { type: "string", enum: ["new", "testing", "validated", "rejected"] }
                  },
                  required: [
                    "title",
                    "hypothesis",
                    "related_pain_point_key",
                    "expected_impact",
                    "confidence",
                    "status"
                  ]
                }
              }
            },
            required: ["main_insight", "pain_points", "hypotheses"]
          }
        }
      }
    ],
    tool_choice: { type: "function", function: { name: toolName } }
  });

  const toolCall = completion.choices[0]?.message.tool_calls?.[0];
  const args = toolCall?.function.arguments;
  if (!args) llmInvalid("missing tool_call");

  let json: unknown;
  try {
    json = JSON.parse(args) as unknown;
  } catch {
    llmInvalid("invalid JSON");
  }
  const parsed = llmResultSchema.safeParse(json);
  if (!parsed.success) {
    llmInvalid("schema validation failed");
  }

  const painPoints: AnalyzedPainPoint[] = parsed.data.pain_points.slice(0, 12).map((p) => {
    const unique = Array.from(new Set(p.evidence_indices.filter((i) => i >= 0 && i < items.length)));
    const quotes = unique.slice(0, 3).map((i) => items[i] ?? "").filter((q) => q.length > 0);
    return {
      llmKey: p.key,
      title: p.title,
      summary: p.summary,
      evidenceCount: unique.length,
      quotes,
      cjmStage: p.cjm_stage,
      severity: p.severity,
      confidence: p.confidence
    };
  });

  const validPainPointKeys = new Set(painPoints.map((p) => p.llmKey));
  const hypotheses: AnalyzedHypothesis[] = parsed.data.hypotheses
    .filter((h) => h.status === "new")
    .filter((h) => validPainPointKeys.has(h.related_pain_point_key))
    .slice(0, 24)
    .map((h) => ({
      title: h.title,
      hypothesis: h.hypothesis,
      relatedPainPointKey: h.related_pain_point_key,
      expectedImpact: h.expected_impact,
      confidence: h.confidence,
      status: h.status
    }));

  return { painPoints, hypotheses, mainInsight: parsed.data.main_insight, model };
}
