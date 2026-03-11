"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/src/client/anon";
import { saveAnalysisCache } from "@/src/client/analysisCache";
import { trackEvent } from "@/src/client/track";
import type { AnalysisDetails, AnalysisListItem } from "@/src/shared/api";
import { posthog } from "@/src/lib/posthog";
import Papa from "papaparse";
import * as XLSX from "xlsx";

function parseFeedbackItems(raw: string, maxItems: number): string[] {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const lines = normalized
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .map((x) => x.replace(/^[-•\u2022]\s+/, "").replace(/^\d+[.)]\s+/, ""));

  if (lines.length <= 1) {
    return [normalized].slice(0, maxItems);
  }
  return lines.slice(0, maxItems);
}

type ParsedTable = {
  columns: string[];
  rows: Record<string, string>[];
};

const HEADER_HINTS = [
  "text",
  "review",
  "comment",
  "feedback",
  "message",
  "отзыв",
  "комментар",
  "фидбек",
  "текст"
];

const ANALYZE_STEPS = [
  "Анализируем отзывы...",
  "Выделяем повторяющиеся проблемы...",
  "Формулируем гипотезы..."
];

const EXAMPLE_INPUT = [
  "Приложение долго открывается после обновления",
  "Не могу быстро найти, где изменить тариф",
  "Поддержка отвечает слишком долго",
  "После регистрации не понимаю, что делать дальше",
  "Слишком много шагов при регистрации",
  "После входа приложение иногда зависает",
  "Не приходит код подтверждения",
  "Непонятно, как восстановить пароль",
  "В разделе оплаты сложно разобраться",
  "Не вижу, где отключить уведомления",
  "Поддержка отвечает шаблонными сообщениями",
  "После последнего релиза стало медленнее",
  "Не могу найти историю операций",
  "Сложно понять, какие тарифы отличаются",
  "Ошибка появляется без объяснения причины",
  "Первый экран перегружен лишней информацией",
  "Форма регистрации слишком длинная",
  "Нельзя быстро поменять способ оплаты",
  "При загрузке документов всё тормозит",
  "Не понимаю, завершилась ли верификация",
  "После обновления выкидывает из аккаунта",
  "Слишком сложно добавить новую карту",
  "Неочевидно, где находится чат поддержки",
  "В onboarding нет понятных подсказок",
  "После авторизации долго крутится загрузка",
  "Интерфейс кажется слишком сложным",
  "Трудно найти настройки профиля",
  "Не хватает поиска по разделам",
  "Push-уведомления приходят слишком часто",
  "Не могу быстро удалить аккаунт",
  "При смене тарифа не показывается итоговая цена",
  "Непонятно, почему отклоняется платеж",
  "Слишком долго загружается главная страница",
  "Нет понятного статуса по заявке",
  "После регистрации не приходит письмо",
  "Очень долго отвечает оператор поддержки",
  "В приложении сложно ориентироваться новичку",
  "Экран оплаты выглядит перегруженным",
  "Не нахожу кнопку отмены подписки",
  "История заказов открывается слишком медленно",
  "Неясно, что делать после ошибки входа",
  "Непонятно, где поменять язык интерфейса",
  "Сложно загрузить документы с телефона",
  "Нет индикатора прогресса при проверке",
  "После обновления часто лагает прокрутка",
  "Не могу понять, прошла ли оплата",
  "Верификация занимает слишком много времени",
  "В разделе помощи нет нужного ответа",
  "Слишком много полей при оформлении",
  "Система слишком часто просит заново войти",
  "Неочевидно, как связаться с поддержкой",
  "Тяжело найти нужную функцию в меню",
  "Уведомления приходят с задержкой",
  "После входа показывается пустой экран",
  "Нельзя быстро повторить прошлое действие",
  "Слишком мелкий текст на некоторых экранах",
  "Не понимаю, чем отличаются статусы заявки",
  "Ошибка оплаты не объясняет, что делать дальше",
  "Функция поиска работает нестабильно",
  "Сложно понять, где посмотреть лимиты",
  "После последнего обновления всё стало медленнее",
  "Нет понятного подтверждения успешного действия",
  "Поддержка не отвечает в чате вовремя",
  "Непонятно, как изменить персональные данные",
  "Слишком много шагов до первого полезного действия",
  "Трудно найти, где включить автоплатеж",
  "При регистрации непонятно, зачем нужны документы",
  "Нет быстрого способа вернуться назад",
  "Сложно разобраться в навигации по разделам",
  "На главном экране слишком много блоков",
  "Неясно, сколько ещё ждать завершения проверки",
  "После авторизации не сохраняется сессия",
  "Не удаётся быстро найти условия тарифа",
  "Подсказки в интерфейсе слишком общие",
  "Прикрепление файлов работает нестабильно",
  "Нет понятной инструкции для первого запуска",
  "Сложно сравнить доступные тарифы",
  "Не видно, какие действия обязательны",
  "Экран подтверждения выглядит запутанно"
].join("\n");

function looksLikeHeaderRow(headerRow: unknown[], nextRow?: unknown[]) {
  const normalized = headerRow.map((cell) => normalizeCell(cell));
  const nonEmpty = normalized.filter((value) => value.length > 0);
  if (nonEmpty.length === 0) return false;

  const hintMatch = nonEmpty.some((value) => HEADER_HINTS.some((hint) => value.toLowerCase().includes(hint)));
  if (hintMatch) return true;

  const mostlyStrings = nonEmpty.length / Math.max(headerRow.length, 1) >= 0.7;
  const uniqueEnough = new Set(nonEmpty.map((value) => value.toLowerCase())).size === nonEmpty.length;
  const nextNormalized = (nextRow ?? []).map((cell) => normalizeCell(cell));
  const nextLooksData = nextNormalized.some((value) => /\d|[.!?]/.test(value));

  return mostlyStrings && uniqueEnough && nextLooksData;
}

function normalizeCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return String(value).trim();
}

function parseCsvToTable(text: string): ParsedTable {
  const withHeader = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true
  });

  const headerColumns = (withHeader.meta.fields ?? [])
    .map((c) => (c ?? "").trim())
    .filter((c): c is string => c.length > 0);
  if (headerColumns.length > 0) {
    const rows = (withHeader.data ?? []).map((row: Record<string, unknown>) => {
      const normalized: Record<string, string> = {};
      for (const key of headerColumns) normalized[key] = normalizeCell(row[key]);
      return normalized;
    });
    return { columns: headerColumns, rows };
  }

  const noHeader = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });
  const matrix = (noHeader.data ?? []).filter(
    (row: unknown) => Array.isArray(row) && (row as unknown[]).some((cell) => String(cell ?? "").trim())
  ) as string[][];
  const maxCols = Math.max(0, ...matrix.map((r: string[]) => r.length));
  const columns = Array.from({ length: maxCols }, (_, i) => `Колонка ${i + 1}`);
  const rows = matrix.map((r: string[]) => {
    const normalized: Record<string, string> = {};
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      if (!col) continue;
      normalized[col] = normalizeCell(r[i]);
    }
    return normalized;
  });
  return { columns, rows };
}

function parseXlsxToTable(buffer: ArrayBuffer): ParsedTable {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return { columns: [], rows: [] };
  const sheet = wb.Sheets[firstSheetName];
  if (!sheet) return { columns: [], rows: [] };

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const rowsArray = matrix.filter((r: unknown) => Array.isArray(r) && (r as unknown[]).some((c) => String(c ?? "").trim()));
  if (rowsArray.length === 0) return { columns: [], rows: [] };

  const headerRow = rowsArray[0] as unknown[];
  const headerLooksReal = looksLikeHeaderRow(headerRow, rowsArray[1] as unknown[] | undefined);

  if (!headerLooksReal) {
    const maxCols = Math.max(0, ...rowsArray.map((row) => (row as unknown[]).length));
    const columns = Array.from({ length: maxCols }, (_, i) => `Колонка ${i + 1}`);
    const rows = rowsArray.map((r) => {
      const normalized: Record<string, string> = {};
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        if (!col) continue;
        normalized[col] = normalizeCell((r as unknown[])[i]);
      }
      return normalized;
    });
    return { columns, rows };
  }

  const header = headerRow.map((c, i) => {
    const cell = normalizeCell(c);
    return cell.length > 0 ? cell : `Колонка ${i + 1}`;
  });

  const rows = rowsArray.slice(1).map((r) => {
    const normalized: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) {
      const col = header[i];
      if (!col) continue;
      normalized[col] = normalizeCell((r as unknown[])[i]);
    }
    return normalized;
  });

  const unique = Array.from(new Set(header.map((h) => h.trim()).filter(Boolean)));
  return { columns: unique, rows };
}

export default function HomeClient({ maxItems }: { maxItems: number }) {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [raw, setRaw] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AnalysisListItem[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileTable, setFileTable] = useState<ParsedTable | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [fileParseError, setFileParseError] = useState<string | null>(null);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);

  const textItems = useMemo(() => parseFeedbackItems(raw, maxItems), [raw, maxItems]);
  const fileItems = useMemo(() => {
    if (!fileTable || !selectedColumn) return [];
    const items = fileTable.rows
      .map((r) => r[selectedColumn])
      .map((x) => x?.trim() ?? "")
      .filter((x) => x.length > 0)
      .slice(0, maxItems);
    return items;
  }, [fileTable, selectedColumn, maxItems]);

  const items = mode === "file" ? fileItems : textItems;

  useEffect(() => {
    void (async () => {
      try {
        await trackEvent("user_open_app", {});
        posthog.capture("visit");
        const res = await authFetch("/api/analyses", {
          headers: {}
        });
        if (!res.ok) return;
        const data = (await res.json()) as { items: AnalysisListItem[] };
        setHistory(data.items);
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setLoadingStepIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setLoadingStepIndex((current) => (current + 1) % ANALYZE_STEPS.length);
    }, 1300);

    return () => window.clearInterval(timer);
  }, [isLoading]);

  async function onFileSelected(file: File) {
    setFileParseError(null);
    setFileName(file.name);
    setFileTable(null);
    setSelectedColumn(null);
    try {
      const ext = file.name.toLowerCase().split(".").pop();
      if (ext === "csv") {
        const text = await file.text();
        const table = parseCsvToTable(text);
        if (table.columns.length === 0) {
          setFileParseError("Не удалось определить колонки в CSV.");
          return;
        }
        setFileTable(table);
        setSelectedColumn(table.columns[0] ?? null);
        return;
      }
      if (ext === "xlsx") {
        const buffer = await file.arrayBuffer();
        const table = parseXlsxToTable(buffer);
        if (table.columns.length === 0) {
          setFileParseError("Не удалось определить колонки в Excel.");
          return;
        }
        setFileTable(table);
        setSelectedColumn(table.columns[0] ?? null);
        return;
      }
      setFileParseError("Поддерживаются только .csv и .xlsx.");
    } catch {
      setFileParseError("Не удалось прочитать файл. Проверьте формат и попробуйте ещё раз.");
    }
  }

  async function onAnalyze() {
    setError(null);
    setIsLoading(true);
    try {
      posthog.capture("analysis_started", { items_count: items.length });
      const res = await authFetch("/api/analyze", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ raw: items.join("\n") })
      });
      const data = (await res.json()) as { analysisId?: string; details?: AnalysisDetails; message?: string };
      if (!res.ok) {
        posthog.capture("analysis_failed", {
          items_count: items.length,
          error_message: data.message ?? `HTTP ${res.status}`
        });
        // Show API-provided message if present (helps debugging production issues).
        if (data.message) {
          setError(data.message);
          return;
        }
        setError(res.status >= 500 ? "Ошибка анализа. Попробуйте ещё раз." : "Не удалось выполнить анализ.");
        return;
      }
      if (!data.analysisId) {
        posthog.capture("analysis_failed", {
          items_count: items.length,
          error_message: "missing analysisId"
        });
        setError("Не удалось получить ID анализа.");
        return;
      }
      if (data.details) {
        saveAnalysisCache(data.details);
      }
      posthog.capture("analysis_completed", { analysisId: data.analysisId, items_count: items.length });
      window.location.href = `/analysis/${data.analysisId}`;
    } catch {
      posthog.capture("analysis_failed", { items_count: items.length, error_message: "network_error" });
      setError("Сеть/сервер недоступны. Попробуйте ещё раз.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Генератор продуктовых инсайтов</h2>
        <p className="muted" style={{ marginTop: -6, whiteSpace: "pre-line" }}>
          {"Анализируйте фидбек. Находите инсайты. Проверяйте гипотезы.\nFeedFocus соберет главное из отзывов пользователей и поможет быстрее перейти от наблюдений к действиям."}
        </p>
        {error ? <div className="error">{error}</div> : null}

        <div className="segmented" style={{ marginTop: 12 }}>
          <button type="button" className={mode === "text" ? "active" : ""} onClick={() => setMode("text")}>
            Вставить текст
          </button>
          <button type="button" className={mode === "file" ? "active" : ""} onClick={() => setMode("file")}>
            Загрузить CSV / Excel
          </button>
        </div>

        {mode === "text" ? (
          <div style={{ marginTop: 12 }}>
            <textarea
              placeholder="Вставьте отзывы или комментарии пользователей"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
            <div className="exampleBox">
              <div className="exampleActionsRow">
                <span className="muted exampleActionsText">Можно вставить отзывы вручную или загрузить пример файла.</span>
                <div className="exampleActionsButtons">
                  <button type="button" className="actionButton secondaryAction" onClick={() => setRaw(EXAMPLE_INPUT)}>
                    Подставить пример
                  </button>
                  <a href="/samples/feedfocus-sample-reviews.xlsx" download className="actionButton secondaryAction sampleLink">
                    Скачать пример Excel
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div className="row" style={{ alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFileSelected(f);
                }}
              />
              {fileName ? <span className="muted">{fileName}</span> : null}
            </div>

            {fileParseError ? <div className="error" style={{ marginTop: 10 }}>{fileParseError}</div> : null}

            {fileTable && fileTable.columns.length > 0 ? (
              <div style={{ marginTop: 10 }}>
                <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="muted">Колонка с текстом:</span>
                  <select
                    value={selectedColumn ?? ""}
                    onChange={(e) => setSelectedColumn(e.target.value)}
                    style={{ minWidth: 240 }}
                  >
                    {fileTable.columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <span className="pill">
                    Найдено отзывов: <b style={{ color: "var(--text)" }}>{items.length}</b>
                  </span>
                </div>
                <div className="muted" style={{ marginTop: 8 }}>
                  Мы возьмём первые {Math.min(items.length, maxItems)} отзывов.
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
          <div className="pill">
            Отзывов: <b style={{ color: "var(--text)" }}>{items.length}</b>
          </div>
          <button className="primary" onClick={onAnalyze} disabled={isLoading || items.length === 0}>
            {isLoading ? "Анализируем..." : "Анализировать"}
          </button>
        </div>

        {isLoading ? (
          <div className="loadingPanel">
            <div className="loadingTitle">{ANALYZE_STEPS[loadingStepIndex]}</div>
            <div className="loadingSkeletonRow" />
            <div className="loadingSkeletonRow short" />
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>История</h3>
        <p className="muted" style={{ marginTop: -6 }}>
          Последние анализы (30 дней).
        </p>
        {history.length === 0 ? (
          <div className="muted">Пока пусто.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Проблемы</th>
                <th>Гипотезы</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {history.map((a) => (
                <tr key={a.id}>
                  <td className="muted">{new Date(a.createdAt).toLocaleString("ru-RU")}</td>
                  <td>{a.painPointsCount}</td>
                  <td>{a.hypothesesCount}</td>
                  <td>
                    <Link href={`/analysis/${a.id}`} className="muted">
                      Открыть →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
