"use client";
import { useEffect, useState } from "react";
import { format, formatDistanceStrict } from "date-fns";
import { ru } from "date-fns/locale";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Clock } from "lucide-react";

interface Run {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: string;
  triggerType: string;
  totalOperators: number;
  successCount: number;
  partialCount: number;
  failedCount: number;
  _count: { tariffs: number; promotions: number };
  items: Array<{
    operatorId: string;
    operator: { name: string };
    status: string;
    method: string;
    errorMsg?: string;
    tariffsFound: number;
    promoFound: number;
    durationMs?: number;
  }>;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  partial: <AlertCircle className="h-4 w-4 text-yellow-600" />,
  failed: <XCircle className="h-4 w-4 text-red-600" />,
  running: <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />,
  pending: <Clock className="h-4 w-4 text-gray-400" />,
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Завершён", partial: "Частично", failed: "Ошибка",
  running: "Выполняется", pending: "Ожидание",
};

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch("/api/runs").then((r) => r.json()).then(setRuns).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 8000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Запуски сбора</h1>
        <p className="text-sm text-gray-500">{runs.length} запусков</p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Загрузка...</div>
      ) : (
        <div className="flex gap-4">
          {/* List */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left px-4 py-2 font-medium">Статус</th>
                  <th className="text-left px-4 py-2 font-medium">Дата</th>
                  <th className="text-left px-4 py-2 font-medium">Тип</th>
                  <th className="text-left px-4 py-2 font-medium">Результаты</th>
                  <th className="text-left px-4 py-2 font-medium">Тарифов / Акций</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Запусков ещё не было</td></tr>
                ) : runs.map((run) => (
                  <tr key={run.id}
                    onClick={() => setSelected(selected?.id === run.id ? null : run)}
                    className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${selected?.id === run.id ? "bg-blue-50" : ""}`}>
                    <td className="px-4 py-2.5 flex items-center gap-1.5">
                      {STATUS_ICONS[run.status]}
                      <span className="text-xs">{STATUS_LABELS[run.status]}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">
                      {format(new Date(run.startedAt), "d MMM yyyy, HH:mm", { locale: ru })}
                      {run.finishedAt && (
                        <span className="text-gray-400 ml-1">
                          ({formatDistanceStrict(new Date(run.startedAt), new Date(run.finishedAt), { locale: ru })})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {run.triggerType === "manual" ? "Вручную" : "По расписанию"}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className="text-green-700">{run.successCount}✓</span>
                      {run.partialCount > 0 && <span className="text-yellow-700 ml-1">{run.partialCount}~</span>}
                      {run.failedCount > 0 && <span className="text-red-700 ml-1">{run.failedCount}✗</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      {run._count.tariffs} / {run._count.promotions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-80 bg-white rounded-lg border border-gray-200 p-4 space-y-3 shrink-0">
              <h3 className="text-sm font-medium text-gray-700">Детали запуска</h3>
              <div className="space-y-2">
                {selected.items.map((item) => (
                  <div key={item.operatorId} className="text-xs border-b border-gray-100 pb-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-800">{item.operator.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        item.status === "success" ? "bg-green-50 text-green-700" :
                        item.status === "partial" ? "bg-yellow-50 text-yellow-700" :
                        "bg-red-50 text-red-700"}`}>
                        {item.status === "success" ? "OK" : item.status === "partial" ? "~" : "✗"}
                      </span>
                    </div>
                    <div className="text-gray-500 mt-0.5">
                      Тарифов: {item.tariffsFound}, Акций: {item.promoFound}
                      {item.durationMs && ` · ${(item.durationMs / 1000).toFixed(1)}с`}
                    </div>
                    {item.errorMsg && <div className="text-red-600 mt-0.5 break-all">{item.errorMsg}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
