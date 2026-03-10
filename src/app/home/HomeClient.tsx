"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getTelegramInitData } from "@/src/client/telegram";
import { trackEvent } from "@/src/client/track";
import type { AnalysisListItem } from "@/src/shared/api";
import type { AppMode } from "@/src/server/env";

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

export default function HomeClient({ appMode }: { appMode: AppMode }) {
  const [raw, setRaw] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AnalysisListItem[]>([]);

  const maxItems = Number(process.env.NEXT_PUBLIC_MAX_FEEDBACK_ITEMS ?? "50");
  const items = useMemo(() => parseFeedbackItems(raw, maxItems), [raw, maxItems]);

  useEffect(() => {
    try {
      // Telegram UI niceties
      (window as any).Telegram?.WebApp?.ready?.();
      (window as any).Telegram?.WebApp?.expand?.();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await trackEvent("user_open_app", {});
        const initData = getTelegramInitData();
        const res = await fetch("/api/analyses", {
          headers: initData ? { "x-telegram-init-data": initData } : {}
        });
        if (!res.ok) return;
        const data = (await res.json()) as { items: AnalysisListItem[] };
        setHistory(data.items);
      } catch {
        // ignore
      }
    })();
  }, []);

  async function onAnalyze() {
    setError(null);
    setIsLoading(true);
    try {
      const initData = getTelegramInitData();
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(initData ? { "x-telegram-init-data": initData } : {})
        },
        body: JSON.stringify({ raw })
      });
      const data = (await res.json()) as { analysisId?: string; message?: string };
      if (!res.ok) {
        setError(data.message ?? "Не удалось выполнить анализ.");
        return;
      }
      if (!data.analysisId) {
        setError("Не удалось получить ID анализа.");
        return;
      }
      window.location.href = `/analysis/${data.analysisId}`;
    } catch {
      setError("Сеть/сервер недоступны. Попробуйте ещё раз.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="info-banner">
        {appMode === "telegram" ? (
          <>Откройте приложение внутри Telegram, чтобы использовать анализ отзывов.</>
        ) : appMode === "demo" ? (
          <>Demo mode: анализ доступен для тестирования. Данные могут быть общими для всех пользователей.</>
        ) : (
          <>Авторизация не настроена. Обратитесь к разработчику.</>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Вставьте пользовательские отзывы</h2>
        <p className="muted" style={{ marginTop: -6 }}>
          До {maxItems} строк (каждая строка = один отзыв/тикет). Лимит: 30 анализов в день.
        </p>
        {error ? <div className="error">{error}</div> : null}
        <div style={{ marginTop: 12 }}>
          <textarea
            placeholder="Например:\nПользователи жалуются, что регистрация слишком сложная\nПодтверждение личности занимает слишком много времени\nПриложение иногда зависает после входа"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
        </div>
        <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
          <div className="pill">
            Отзывов: <b style={{ color: "var(--text)" }}>{items.length}</b>
          </div>
          <button className="primary" onClick={onAnalyze} disabled={isLoading || items.length === 0}>
            {isLoading ? "Анализируем..." : "Анализировать"}
          </button>
        </div>
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
                <th>Pain points</th>
                <th>Hypotheses</th>
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

