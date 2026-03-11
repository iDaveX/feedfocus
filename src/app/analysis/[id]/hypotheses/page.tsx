"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { authFetch } from "@/src/client/anon";
import { hasAnalysisCache, readAnalysisCache } from "@/src/client/analysisCache";
import { downloadHypothesesPdf } from "@/src/client/pdf";
import type { AnalysisDetails, HypothesisStatus } from "@/src/shared/api";
import { trackEvent } from "@/src/client/track";

const STATUSES: HypothesisStatus[] = ["new", "testing", "validated", "rejected"];
const STATUS_RU: Record<HypothesisStatus, string> = {
  new: "новая",
  testing: "тестируется",
  validated: "подтверждена",
  rejected: "отклонена"
};

const LEVEL_RU: Record<string, string> = {
  low: "низкий",
  medium: "средний",
  high: "высокий"
};

export default function HypothesesPage() {
  const params = useParams<{ id: string }>();
  const analysisId = params.id;
  const [data, setData] = useState<AnalysisDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openHypothesisId, setOpenHypothesisId] = useState<string | null>(null);

  useEffect(() => {
    const cached = readAnalysisCache(analysisId);
    const hasCached = Boolean(cached);
    if (cached) {
      setData(cached);
      setError(null);
    }

    void (async () => {
      try {
        const res = await authFetch(`/api/analyses/${analysisId}`, {
          headers: {}
        });
        const json = (await res.json()) as AnalysisDetails | { message?: string };
        if (!res.ok) {
          if (!hasCached) {
            setError((json as { message?: string }).message ?? "Не удалось загрузить.");
          }
          return;
        }
        setData(json as AnalysisDetails);
      } catch {
        if (!hasCached) {
          setError("Сеть/сервер недоступны.");
        }
      }
    })();
  }, [analysisId]);

  const painPointById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of data?.painPoints ?? []) map.set(p.id, p.title);
    return map;
  }, [data]);

  const hypothesesSorted = useMemo(() => {
    if (!data) return [];
    return [...data.hypotheses];
  }, [data]);

  async function onDownloadHypotheses() {
    if (!data) return;
    if (!hasAnalysisCache(analysisId)) return;
    await downloadHypothesesPdf(data, `feedfocus-hypotheses-${analysisId}.pdf`);
  }

  async function setStatus(hypothesisId: string, status: HypothesisStatus) {
    try {
      const res = await authFetch(`/api/hypotheses/${hypothesisId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(json?.message ?? "Не удалось обновить статус.");
      }
      await trackEvent("hypothesis_status_changed", { hypothesisId, status, analysisId });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          hypotheses: prev.hypotheses.map((h) => (h.id === hypothesisId ? { ...h, status } : h))
        };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка обновления статуса.");
    }
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
            <h2 style={{ margin: 0 }}>Продуктовые гипотезы</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              {data.hypotheses.length} гипотез · статус можно менять вручную
            </div>
          </div>
          <div className="row">
            {hasAnalysisCache(analysisId) ? <button onClick={() => void onDownloadHypotheses()}>Скачать отчет</button> : null}
            <Link href={`/analysis/${analysisId}`} className="muted">
              ← Результаты анализа
            </Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="desktopOnly">
          <table className="table compactTable" style={{ marginTop: 4 }}>
            <thead>
              <tr>
                <th>Гипотеза</th>
                <th>Эффект</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {hypothesesSorted.map((h) => {
                const isOpen = openHypothesisId === h.id;
                return (
                  <Fragment key={h.id}>
                    <tr className="rowClickable" onClick={() => setOpenHypothesisId(isOpen ? null : h.id)}>
                      <td style={{ fontWeight: 700 }}>
                        {h.title}{" "}
                        <span className="muted" style={{ fontWeight: 500 }}>
                          {isOpen ? "▲" : "▼"}
                        </span>
                      </td>
                      <td className="muted">{LEVEL_RU[h.expectedImpact] ?? h.expectedImpact}</td>
                      <td>
                        <select
                          value={h.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setStatus(h.id, e.target.value as HypothesisStatus)}
                        >
                          {STATUSES.map((s) => (
                            <option value={s} key={s}>
                              {STATUS_RU[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="rowDetails">
                        <td colSpan={3}>
                          <div className="detailsBox">
                            <div className="muted feedback-text">{h.hypothesis}</div>
                            <div className="muted" style={{ marginTop: 8 }}>
                              Проблема: {painPointById.get(h.painPointId) ?? "—"}
                            </div>
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
          {hypothesesSorted.map((h) => {
            const isOpen = openHypothesisId === h.id;
            return (
              <div className="compactCard" key={h.id}>
                <div style={{ fontWeight: 800 }}>{h.title}</div>
                <div className="muted" style={{ marginTop: 8 }}>
                  <div>
                    <b style={{ color: "var(--text)" }}>Эффект:</b> {LEVEL_RU[h.expectedImpact] ?? h.expectedImpact}
                  </div>
                </div>
                <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
                  <button onClick={() => setOpenHypothesisId(isOpen ? null : h.id)}>
                    {isOpen ? "Скрыть детали" : "Показать детали"}
                  </button>
                  <select value={h.status} onChange={(e) => setStatus(h.id, e.target.value as HypothesisStatus)}>
                    {STATUSES.map((s) => (
                      <option value={s} key={s}>
                        {STATUS_RU[s]}
                      </option>
                    ))}
                  </select>
                </div>
                {isOpen ? (
                  <div className="detailsBox" style={{ marginTop: 10 }}>
                    <div className="muted feedback-text">{h.hypothesis}</div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      Проблема: {painPointById.get(h.painPointId) ?? "—"}
                    </div>
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
