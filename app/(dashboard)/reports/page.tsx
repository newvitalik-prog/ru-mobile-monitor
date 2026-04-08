"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface ReportData {
  latestRun: {
    id: string; startedAt: string; status: string;
    successCount: number; totalOperators: number;
    _count: { tariffs: number; promotions: number };
  } | null;
  changes: { summary: { new: number; changed: number; removed: number } };
  topTariffs: Array<{
    operator: { name: string }; tariffName: string; monthlyFeeRub?: number; dataGb?: number;
  }>;
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/changes").then((r) => r.json()),
      fetch("/api/tariffs").then((r) => r.json()),
    ]).then(([dashboard, changes, tariffs]) => {
      setData({
        latestRun: dashboard.latestRun,
        changes,
        topTariffs: tariffs.slice(0, 10),
      });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-sm text-gray-500">Загрузка...</div>;

  const run = data?.latestRun;
  const today = format(new Date(), "yyyy-MM-dd");
  const reportTitle = `RU Mobile Tariffs Weekly — ${today}`;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Отчёты</h1>
          <p className="text-sm text-gray-500">Еженедельный отчёт по тарифам</p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
          Печать / PDF
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6 max-w-4xl">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{reportTitle}</h2>
          <p className="text-sm text-gray-500 mt-1">
            Дата формирования: {format(new Date(), "d MMMM yyyy", { locale: ru })}
          </p>
        </div>

        <section>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">1. Сводка</h3>
          {run ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded p-3">
                <div className="text-2xl font-bold text-gray-900">{run._count.tariffs}</div>
                <div className="text-xs text-gray-500">тарифов собрано</div>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <div className="text-2xl font-bold text-gray-900">{run._count.promotions}</div>
                <div className="text-xs text-gray-500">акций собрано</div>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <div className="text-2xl font-bold text-gray-900">{run.successCount}/{run.totalOperators}</div>
                <div className="text-xs text-gray-500">операторов успешно</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded">
              Базовая неделя — без сравнения с прошлой неделей. Запустите первый сбор данных.
            </p>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">2. Изменения за период</h3>
          {data?.changes?.summary ? (
            <div className="flex gap-4">
              <span className="text-green-700 bg-green-50 px-3 py-2 rounded text-sm">
                +{data.changes.summary.new} новых тарифов
              </span>
              <span className="text-blue-700 bg-blue-50 px-3 py-2 rounded text-sm">
                ~{data.changes.summary.changed} изменено
              </span>
              <span className="text-red-700 bg-red-50 px-3 py-2 rounded text-sm">
                -{data.changes.summary.removed} удалено
              </span>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Недостаточно данных для сравнения (нужно 2 запуска)</p>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">3. Примеры собранных тарифов</h3>
          {data?.topTariffs && data.topTariffs.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-200">
                  <th className="text-left py-1 font-medium">Оператор</th>
                  <th className="text-left py-1 font-medium">Тариф</th>
                  <th className="text-right py-1 font-medium">₽/мес</th>
                  <th className="text-right py-1 font-medium">ГБ</th>
                </tr>
              </thead>
              <tbody>
                {data.topTariffs.map((t, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1.5 text-gray-700">{t.operator.name}</td>
                    <td className="py-1.5 text-gray-900">{t.tariffName}</td>
                    <td className="py-1.5 text-right text-gray-700">{t.monthlyFeeRub ?? "—"}</td>
                    <td className="py-1.5 text-right text-gray-700">{t.dataGb ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500">Нет данных. Запустите сбор.</p>
          )}
        </section>

        <section className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">4. Google Docs</h3>
          <p className="text-sm text-gray-500 mb-2">
            Для экспорта в Google Docs настройте Google Service Account в переменных окружения (GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_DOCS_FOLDER_ID).
          </p>
          <div className="text-xs text-gray-400 bg-gray-50 p-3 rounded font-mono">
            Документ будет создан с названием: &quot;{reportTitle}&quot;
          </div>
        </section>
      </div>
    </div>
  );
}
