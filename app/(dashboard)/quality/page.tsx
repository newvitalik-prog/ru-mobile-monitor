"use client";
import { useEffect, useState } from "react";

interface QualityData {
  runs: Array<{
    id: string; status: string; startedAt: string;
    items: Array<{
      operator: { name: string };
      status: string; method: string;
      errorMsg?: string;
      tariffsFound: number;
    }>;
  }>;
}

export default function QualityPage() {
  const [data, setData] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/runs").then((r) => r.json()).then((runs) => setData({ runs })).finally(() => setLoading(false));
  }, []);

  const latestRun = data?.runs[0];
  const failedItems = latestRun?.items.filter((i) => i.status === "failed") ?? [];
  const emptyItems = latestRun?.items.filter((i) => i.status === "success" && i.tariffsFound === 0) ?? [];
  const partialItems = latestRun?.items.filter((i) => i.status === "partial") ?? [];

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Качество данных</h1>
        <p className="text-sm text-gray-500">Ошибки парсинга и предупреждения последнего запуска</p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Загрузка...</div>
      ) : !latestRun ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400 text-sm">
          Запусков ещё не было
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className={`rounded-lg border p-4 ${failedItems.length > 0 ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
              <div className="text-2xl font-bold text-red-700">{failedItems.length}</div>
              <div className="text-xs text-gray-600 mt-1">Ошибок сбора</div>
            </div>
            <div className={`rounded-lg border p-4 ${partialItems.length > 0 ? "border-yellow-200 bg-yellow-50" : "border-gray-200 bg-white"}`}>
              <div className="text-2xl font-bold text-yellow-700">{partialItems.length}</div>
              <div className="text-xs text-gray-600 mt-1">Частичный сбор</div>
            </div>
            <div className={`rounded-lg border p-4 ${emptyItems.length > 0 ? "border-orange-200 bg-orange-50" : "border-gray-200 bg-white"}`}>
              <div className="text-2xl font-bold text-orange-700">{emptyItems.length}</div>
              <div className="text-xs text-gray-600 mt-1">Тарифов не найдено</div>
            </div>
          </div>

          {/* Errors */}
          {failedItems.length > 0 && (
            <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-200">
                <h2 className="text-sm font-medium text-red-800">Ошибки сбора ({failedItems.length})</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {failedItems.map((item, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{item.operator.name}</div>
                    {item.errorMsg && (
                      <div className="text-xs text-red-600 mt-1 font-mono break-all">{item.errorMsg}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Partial */}
          {partialItems.length > 0 && (
            <div className="bg-white rounded-lg border border-yellow-200 overflow-hidden">
              <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-200">
                <h2 className="text-sm font-medium text-yellow-800">Частичный сбор ({partialItems.length})</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {partialItems.map((item, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between">
                    <div className="text-sm text-gray-900">{item.operator.name}</div>
                    <div className="text-xs text-gray-500">Тарифов найдено: {item.tariffsFound}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {failedItems.length === 0 && partialItems.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
              Проблем не обнаружено в последнем запуске.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
