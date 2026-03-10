"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { AnalysisDetails } from "@/src/shared/api";

export default function AnalysisPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<AnalysisDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

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
              {new Date(data.analysis.createdAt).toLocaleString("ru-RU")} · {data.painPoints.length} pain points ·{" "}
              {data.hypotheses.length} hypotheses
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
        <h3 style={{ marginTop: 0 }}>Pain points</h3>
        <div className="muted" style={{ marginTop: -6 }}>
          Каждый pain point — отдельная карточка (CJM, severity, evidence, quotes).
        </div>
      </div>

      {data.painPoints.map((p) => (
        <div className="card" key={p.id}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{p.title}</div>
              <div className="muted feedback-text" style={{ marginTop: 6 }}>
                {p.summary}
              </div>
            </div>
            <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
              <div className="pill">CJM: {p.cjmStage}</div>
              <div className="pill">Severity: {p.severity}</div>
              <div className="pill">Evidence: {p.evidenceCount}</div>
            </div>
          </div>

          {p.quotes.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 12, letterSpacing: 0.2 }}>
                Quotes
              </div>
              <ul style={{ margin: "8px 0 0", paddingLeft: 16 }}>
                {p.quotes.slice(0, 3).map((q, i) => (
                  <li key={i} className="muted feedback-text">
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ))}
    </>
  );
}
