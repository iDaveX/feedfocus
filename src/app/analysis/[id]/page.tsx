"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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

const SEVERITY_RU: Record<string, string> = {
  low: "низкая",
  medium: "средняя",
  high: "высокая"
};

export default function AnalysisPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<AnalysisDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPainPointId, setOpenPainPointId] = useState<string | null>(null);

  const painPointsSorted = useMemo(() => {
    if (!data) return [];
    return [...data.painPoints].sort((a, b) => (b.evidenceCount ?? 0) - (a.evidenceCount ?? 0));
  }, [data]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/analyses/${id}`, {
          headers: {}
        });
        const json = (await res.json()) as AnalysisDetails | { message?: string };
        if (!res.ok) {
          setError((json as { message?: string }).message ?? "Не удалось загрузить анализ.");
          return;
        }
        setData(json as AnalysisDetails);
      } catch {
        setError("Сеть/сервер недоступны.");
      }
    })();
  }, [id]);

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
            <Link href={`/analysis/${id}/hypotheses`}>
              <button className="primary">Гипотезы →</button>
            </Link>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Проблемы (pain points)</h3>
        <table className="table compactTable" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>Проблема</th>
              <th>Отзывов</th>
              <th>Этап CJM</th>
              <th>Серьёзность</th>
            </tr>
          </thead>
          <tbody>
            {painPointsSorted.map((p) => {
              const isOpen = openPainPointId === p.id;
              const stage = CJM_STAGE_RU[p.cjmStage] ?? p.cjmStage;
              const sev = SEVERITY_RU[p.severity] ?? p.severity;
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
    </>
  );
}
