"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/src/client/anon";
import type { DashboardData } from "@/src/shared/api";

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

const STATUS_RU: Record<string, string> = {
  new: "Новые",
  testing: "Тестируются",
  validated: "Подтверждены",
  rejected: "Отклонены"
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await authFetch(`/api/dashboard`, {
          headers: {}
        });
        const json = (await res.json()) as DashboardData | { message?: string };
        if (!res.ok) {
          setError((json as { message?: string }).message ?? "Не удалось загрузить дашборд.");
          return;
        }
        setData(json as DashboardData);
      } catch {
        setError("Сеть/сервер недоступны.");
      }
    })();
  }, []);

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
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Сводка анализа</h2>

      <div className="kpi" style={{ marginTop: 12 }}>
        <div className="kpiItem">
          <div className="kpiLabel">Анализов выполнено</div>
          <div className="kpiValue">{data.kpi.analysesPerformed}</div>
        </div>
        <div className="kpiItem">
          <div className="kpiLabel">Проблем найдено</div>
          <div className="kpiValue">{data.kpi.painPointsDetected}</div>
        </div>
        <div className="kpiItem">
          <div className="kpiLabel">Гипотез сгенерировано</div>
          <div className="kpiValue">{data.kpi.hypothesesGenerated}</div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 16, gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h3 style={{ marginTop: 0 }}>Топ этапов CJM</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Этап</th>
                <th>Доля</th>
              </tr>
            </thead>
            <tbody>
              {data.topCjmStages.map((x) => (
                <tr key={x.stage}>
                  <td className="muted">{CJM_STAGE_RU[x.stage] ?? x.stage}</td>
                  <td>{Math.round(x.share * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ flex: 1, minWidth: 280 }}>
          <h3 style={{ marginTop: 0 }}>Статусы гипотез</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Статус</th>
                <th>Количество</th>
              </tr>
            </thead>
            <tbody>
              {data.hypothesisStatus.map((x) => (
                <tr key={x.status}>
                  <td className="muted">{STATUS_RU[x.status] ?? x.status}</td>
                  <td>{x.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Примечание</h3>
        <div className="muted">Данные хранятся 30 дней и доступны в рамках текущего браузера/пользователя.</div>
      </div>
    </div>
  );
}
