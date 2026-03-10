"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getTelegramInitData } from "@/src/client/telegram";
import type { AnalysisDetails, HypothesisStatus } from "@/src/shared/api";
import { trackEvent } from "@/src/client/track";

const STATUSES: HypothesisStatus[] = ["new", "testing", "validated", "rejected"];

export default function HypothesesPage() {
  const params = useParams<{ id: string }>();
  const analysisId = params.id;
  const [data, setData] = useState<AnalysisDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const initData = getTelegramInitData();
        const res = await fetch(`/api/analyses/${analysisId}`, {
          headers: initData ? { "x-telegram-init-data": initData } : {}
        });
        const json = (await res.json()) as AnalysisDetails | { message?: string };
        if (!res.ok) {
          setError((json as { message?: string }).message ?? "Не удалось загрузить.");
          return;
        }
        setData(json as AnalysisDetails);
      } catch {
        setError("Сеть/сервер недоступны.");
      }
    })();
  }, [analysisId]);

  const painPointById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of data?.painPoints ?? []) map.set(p.id, p.title);
    return map;
  }, [data]);

  async function setStatus(hypothesisId: string, status: HypothesisStatus) {
    try {
      const initData = getTelegramInitData();
      const res = await fetch(`/api/hypotheses/${hypothesisId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(initData ? { "x-telegram-init-data": initData } : {})
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
            <h2 style={{ margin: 0 }}>Гипотезы</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              {data.hypotheses.length} hypotheses · статус можно менять вручную
            </div>
          </div>
          <Link href={`/analysis/${analysisId}`} className="muted">
            ← Результаты
          </Link>
        </div>
      </div>

      {data.hypotheses.map((h) => (
        <div className="card" key={h.id}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{h.title}</div>
              <div className="muted feedback-text" style={{ marginTop: 6 }}>
                {h.hypothesis}
              </div>
            </div>
            <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
              <div className="pill">Impact: {h.expectedImpact}</div>
              <div className="pill">Confidence: {h.confidence}</div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
            <div className="muted" style={{ minWidth: 260, overflowWrap: "anywhere" }}>
              Related: {painPointById.get(h.painPointId) ?? "—"}
            </div>
            <div className="row">
              <select value={h.status} onChange={(e) => setStatus(h.id, e.target.value as HypothesisStatus)}>
                {STATUSES.map((s) => (
                  <option value={s} key={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
