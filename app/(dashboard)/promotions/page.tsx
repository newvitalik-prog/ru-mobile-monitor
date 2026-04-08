"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Promo {
  id: string;
  operator: { name: string; category: string };
  promotionName: string;
  promotionType?: string;
  mechanismSummary?: string;
  benefitValue?: string;
  startDate?: string;
  endDate?: string;
  restrictions?: string;
  sourceUrl?: string;
  collectedAt: string;
  ambiguityFlag: boolean;
}

interface Operator { id: string; name: string }

export default function PromotionsPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOp, setFilterOp] = useState("");

  useEffect(() => {
    fetch("/api/operators").then((r) => r.json()).then(setOperators);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterOp) params.set("operatorId", filterOp);
    fetch(`/api/promotions?${params}`).then((r) => r.json()).then(setPromos).finally(() => setLoading(false));
  }, [filterOp]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Акции и спецпредложения</h1>
          <p className="text-sm text-gray-500">{promos.length} акций</p>
        </div>
        <select value={filterOp} onChange={(e) => setFilterOp(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm">
          <option value="">Все операторы</option>
          {operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Загрузка...</div>
      ) : promos.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400 text-sm">
          Акций не найдено. Запустите сбор данных.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                <th className="text-left px-3 py-2 font-medium">Оператор</th>
                <th className="text-left px-3 py-2 font-medium">Название акции</th>
                <th className="text-left px-3 py-2 font-medium">Тип</th>
                <th className="text-left px-3 py-2 font-medium">Выгода</th>
                <th className="text-left px-3 py-2 font-medium">Описание</th>
                <th className="text-left px-3 py-2 font-medium">Период</th>
                <th className="text-left px-3 py-2 font-medium">Источник</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="text-xs font-medium text-gray-900">{p.operator.name}</div>
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900 max-w-[180px]">
                    <div className="truncate" title={p.promotionName}>{p.promotionName}</div>
                    {p.ambiguityFlag && <span className="text-xs text-orange-600">⚠ неточность</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{p.promotionType ?? "—"}</td>
                  <td className="px-3 py-2 text-xs font-medium text-green-700">{p.benefitValue ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 max-w-[200px]">
                    <div className="truncate" title={p.mechanismSummary ?? ""}>{p.mechanismSummary ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {p.startDate && format(new Date(p.startDate), "d MMM", { locale: ru })}
                    {p.startDate && p.endDate && " — "}
                    {p.endDate && format(new Date(p.endDate), "d MMM yyyy", { locale: ru })}
                    {!p.startDate && !p.endDate && "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.sourceUrl ? (
                      <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="text-blue-500 hover:underline">ссылка</a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
