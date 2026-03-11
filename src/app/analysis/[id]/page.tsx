"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { hasAnalysisCache, readAnalysisCache } from "@/src/client/analysisCache";
import { downloadAnalysisReportPdf } from "@/src/client/pdf";
import { authFetch } from "@/src/client/anon";
import type { AnalysisDetails } from "@/src/shared/api";
import { posthog } from "@/src/lib/posthog";

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

function formatMainInsight(value: string | null | undefined, fallbackTitle?: string) {
  const raw = value?.trim();
  if (!raw) {
    return fallbackTitle ? `Главная проблема пользователей — ${fallbackTitle}.` : "—";
  }

  const normalized = raw.replace(/\s+/g, " ").trim();
  const firstSentenceMatch = normalized.match(/^(.+?[.!?])(?:\s|$)/);
  const firstSentence = firstSentenceMatch?.[1]?.trim() ?? normalized;

  if (firstSentence.length <= 180) {
    return firstSentence;
  }

  const clipped = firstSentence.slice(0, 177).trimEnd();
  return clipped.endsWith(".") ? clipped : `${clipped}…`;
}

export default function AnalysisPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<AnalysisDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPainPointId, setOpenPainPointId] = useState<string | null>(null);
  const trackedViewed = useRef(false);

  const painPointsSorted = useMemo(() => {
    if (!data) return [];
    return [...data.painPoints].sort((a, b) => (b.evidenceCount ?? 0) - (a.evidenceCount ?? 0));
  }, [data]);

  useEffect(() => {
    const cached = readAnalysisCache(id);
    const hasCached = Boolean(cached);
    if (cached) {
      setData(cached);
      setError(null);
    }

    let cancelled = false;

    void (async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          const res = await authFetch(`/api/analyses/${id}`, {
            headers: {},
            cache: "no-store"
          });
          const json = (await res.json()) as AnalysisDetails | { message?: string };
          if (res.ok) {
            if (!cancelled) {
              setData(json as AnalysisDetails);
              setError(null);
            }
            return;
          }

          const message = (json as { message?: string }).message ?? "Не удалось загрузить анализ.";
          if (res.status === 404 && attempt < 5) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }

          if (!cancelled && !hasCached) setError(message);
          return;
        } catch {
          if (!cancelled && !hasCached) setError("Сеть/сервер недоступны.");
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!data) return;
    if (trackedViewed.current) return;
    trackedViewed.current = true;
    posthog.capture("analysis_viewed", {
      analysisId: data.analysis.id,
      pain_points_count: data.painPoints.length
    });
  }, [data]);

  async function onDownloadReport() {
    if (!data) return;

    if (!hasAnalysisCache(id)) {
      window.location.href = `/api/analyses/${id}/report`;
      return;
    }
    await downloadAnalysisReportPdf(data, `feedfocus-report-${id}.pdf`);
  }

  if (error) {
    return (
      <div className="card">
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <div className="muted">Загружаем...</div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0 }}>Результаты анализа</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              {new Date(data.analysis.createdAt).toLocaleString("ru-RU")} · {data.painPoints.length} проблем ·{" "}
              {data.hypotheses.length} гипотез
            </div>
          </div>
          <div className="row">
            <button onClick={() => void onDownloadReport()}>Скачать отчет</button>
            <Link href={`/analysis/${id}/hypotheses`}>
              <button className="primary">Продуктовые гипотезы →</button>
            </Link>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Главный инсайт</h3>
        <div className="muted feedback-text">
          {formatMainInsight(data.analysis.mainInsight, painPointsSorted[0]?.title)}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Проблемы пользователей</h3>
        <div className="desktopOnly">
          <table className="table compactTable" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Проблема</th>
                <th>Отзывов</th>
                <th>Этап CJM</th>
                <th>Приоритет</th>
              </tr>
            </thead>
            <tbody>
              {painPointsSorted.map((p) => {
                const isOpen = openPainPointId === p.id;
                const stage = CJM_STAGE_RU[p.cjmStage] ?? p.cjmStage;
                const sev = PRIORITY_RU[p.severity] ?? p.severity;
                return (
                  <Fragment key={p.id}>
                    <tr className="rowClickable" onClick={() => setOpenPainPointId(isOpen ? null : p.id)}>
                      <td style={{ fontWeight: 700 }}>
                        {p.title}{" "}
                        <span className="muted" style={{ fontWeight: 500 }}>
                          {isOpen ? "▲" : "▼"}
                        </span>
                      </td>
                      <td className="muted">{p.evidenceCount}</td>
                      <td className="muted">{stage}</td>
                      <td className="muted">{sev}</td>
                    </tr>
                    {isOpen ? (
                      <tr className="rowDetails">
                        <td colSpan={4}>
                          <div className="detailsBox">
                            <div className="muted feedback-text">{p.summary}</div>
                            {p.quotes.length > 0 ? (
                              <ul style={{ margin: "10px 0 0", paddingLeft: 16 }}>
                                {p.quotes.slice(0, 3).map((q, i) => (
                                  <li key={i} className="muted feedback-text">
                                    {q}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mobileOnly" style={{ marginTop: 10 }}>
          {painPointsSorted.map((p) => {
            const isOpen = openPainPointId === p.id;
            const stage = CJM_STAGE_RU[p.cjmStage] ?? p.cjmStage;
            const sev = PRIORITY_RU[p.severity] ?? p.severity;
            return (
              <div className="compactCard" key={p.id}>
                <div style={{ fontWeight: 800 }}>{p.title}</div>
                <div className="muted" style={{ marginTop: 8 }}>
                  <div>
                    <b style={{ color: "var(--text)" }}>Отзывов:</b> {p.evidenceCount}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <b style={{ color: "var(--text)" }}>Этап CJM:</b> {stage}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <b style={{ color: "var(--text)" }}>Приоритет:</b> {sev}
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <button onClick={() => setOpenPainPointId(isOpen ? null : p.id)}>
                    {isOpen ? "Скрыть детали" : "Показать детали"}
                  </button>
                </div>

                {isOpen ? (
                  <div className="detailsBox" style={{ marginTop: 10 }}>
                    <div className="muted feedback-text">{p.summary}</div>
                    {p.quotes.length > 0 ? (
                      <ul style={{ margin: "10px 0 0", paddingLeft: 16 }}>
                        {p.quotes.slice(0, 3).map((q, i) => (
                          <li key={i} className="muted feedback-text">
                            {q}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
