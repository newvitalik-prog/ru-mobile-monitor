"use client";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Change {
  type: "new" | "removed" | "changed";
  current?: {
    id: string; tariffName: string; monthlyFeeRub?: number; dataGb?: number;
    voiceMinutes?: number; smsCount?: number;
    operator: { name: string; category: string };
  } | null;
  baseline?: {
    id: string; tariffName: string; monthlyFeeRub?: number; dataGb?: number;
    voiceMinutes?: number; smsCount?: number;
    operator: { name: string };
  } | null;
  diff?: Record<string, { old: unknown; new: unknown }>;
}

interface ChangesData {
  changes: Change[];
  summary: { new: number; changed: number; removed: number };
  message?: string;
}

const FIELD_LABELS: Record<string, string> = {
  monthlyFeeRub: "Цена, ₽",
  dataGb: "Интернет, ГБ",
  voiceMinutes: "Минуты",
  smsCount: "СМС",
};

export default function ChangesPage() {
  const [data, setData] = useState<ChangesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "changed" | "removed">("all");

  useEffect(() => {
    fetch("/api/changes").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  const changes = data?.changes.filter((c) => filter === "all" || c.type === filter) ?? [];

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Изменения</h1>
        <p className="text-sm text-gray-500">Сравнение двух последних успешных запусков</p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Загрузка...</div>
      ) : data?.message ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">{data.message}</div>
      ) : (
        <>
          {/* Summary */}
          <div className="flex gap-3">
            {[
              { key: "all", label: "Все", count: data?.changes.length ?? 0, color: "text-gray-700 bg-gray-50" },
              { key: "new", label: "Новые", count: data?.summary.new ?? 0, color: "text-green-700 bg-green-50" },
              { key: "changed", label: "Изменились", count: data?.summary.changed ?? 0, color: "text-blue-700 bg-blue-50" },
              { key: "removed", label: "Удалены", count: data?.summary.removed ?? 0, color: "text-red-700 bg-red-50" },
            ].map(({ key, label, count, color }) => (
              <button key={key} onClick={() => setFilter(key as typeof filter)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${filter === key ? `${color} border-current` : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {label}: {count}
              </button>
            ))}
          </div>

          {/* Changes List */}
          {changes.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400 text-sm">
              Изменений не найдено
            </div>
          ) : (
            <div className="space-y-2">
              {changes.map((change, i) => {
                const tariff = change.current ?? change.baseline;
                const opName = change.current?.operator?.name ?? change.baseline?.operator?.name ?? "—";
                return (
                  <div key={i} className={`bg-white rounded-lg border p-4 ${
                    change.type === "new" ? "border-green-200" :
                    change.type === "removed" ? "border-red-200" :
                    "border-blue-200"
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            change.type === "new" ? "bg-green-50 text-green-700" :
                            change.type === "removed" ? "bg-red-50 text-red-700" :
                            "bg-blue-50 text-blue-700"
                          }`}>
                            {change.type === "new" ? "НОВЫЙ" : change.type === "removed" ? "УДАЛЁН" : "ИЗМЕНЁН"}
                          </span>
                          <span className="text-xs text-gray-500">{opName}</span>
                        </div>
                        <div className="text-sm font-medium text-gray-900 mt-1">{tariff?.tariffName}</div>
                      </div>
                      {change.type === "new" && <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />}
                      {change.type === "removed" && <TrendingDown className="h-4 w-4 text-red-600 shrink-0" />}
                      {change.type === "changed" && <Minus className="h-4 w-4 text-blue-600 shrink-0" />}
                    </div>

                    {change.diff && Object.keys(change.diff).length > 0 && (
                      <div className="mt-3 space-y-1">
                        {Object.entries(change.diff).map(([field, val]) => (
                          <div key={field} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500 w-24">{FIELD_LABELS[field] ?? field}</span>
                            <span className="line-through text-red-600">{String(val.old)}</span>
                            <span className="text-gray-400">→</span>
                            <span className="text-green-700 font-medium">{String(val.new)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {change.type === "new" && change.current && (
                      <div className="mt-2 flex gap-4 text-xs text-gray-500">
                        {change.current.monthlyFeeRub && <span>{change.current.monthlyFeeRub} ₽/мес</span>}
                        {change.current.dataGb && <span>{change.current.dataGb} ГБ</span>}
                        {change.current.voiceMinutes && <span>{change.current.voiceMinutes} мин</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
