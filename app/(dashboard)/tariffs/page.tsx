"use client";
import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Tariff {
  id: string;
  operator: { name: string; category: string };
  tariffName: string;
  segment?: string;
  monthlyFeeRub?: number;
  dataGb?: number;
  dataUnlimited: boolean;
  voiceMinutes?: number;
  voiceUnlimited: boolean;
  smsCount?: number;
  includedServices?: string;
  esimAvailable?: boolean;
  sourceUrl?: string;
  parserConfidence?: number;
  collectionMethod?: string;
}

interface Run {
  id: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  successCount: number;
  totalOperators: number;
}

interface Operator { id: string; name: string }

export default function TariffsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOp, setFilterOp] = useState("");
  const [search, setSearch] = useState("");

  // Load runs list on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/tariffs").then((r) => r.json()),
      fetch("/api/operators").then((r) => r.json()),
    ]).then(([data, ops]) => {
      const runList: Run[] = data.runs ?? [];
      setRuns(runList);
      setOperators(ops);
      // Auto-select latest run
      if (runList.length > 0) {
        setSelectedRunId(runList[0].id);
      } else {
        setLoading(false);
      }
    });
  }, []);

  // Load tariffs when run or filters change
  const loadTariffs = useCallback(() => {
    if (!selectedRunId) return;
    setLoading(true);
    const params = new URLSearchParams({ runId: selectedRunId });
    if (filterOp) params.set("operatorId", filterOp);
    if (search) params.set("search", search);
    fetch(`/api/tariffs?${params}`)
      .then((r) => r.json())
      .then((data) => setTariffs(data.tariffs ?? []))
      .finally(() => setLoading(false));
  }, [selectedRunId, filterOp, search]);

  useEffect(() => { loadTariffs(); }, [loadTariffs]);

  const selectedRun = runs.find((r) => r.id === selectedRunId);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Тарифы</h1>
          <p className="text-sm text-gray-500">{tariffs.length} тарифов</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию..."
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-44"
          />
          <select
            value={filterOp}
            onChange={(e) => setFilterOp(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">Все операторы</option>
            {operators.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <select
            value={selectedRunId}
            onChange={(e) => setSelectedRunId(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
          >
            {runs.length === 0 && <option value="">Нет данных</option>}
            {runs.map((r, i) => (
              <option key={r.id} value={r.id}>
                {i === 0 ? "▶ " : ""}{format(new Date(r.startedAt), "d MMM, HH:mm", { locale: ru })} — {r.successCount}/{r.totalOperators} оп.
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedRun && (
        <div className="flex gap-4 text-xs text-gray-500 bg-gray-50 rounded px-3 py-2 border border-gray-100">
          <span>Запуск: <span className="font-medium text-gray-700">{format(new Date(selectedRun.startedAt), "d MMMM yyyy, HH:mm", { locale: ru })}</span></span>
          <span>Статус: <span className={`font-medium ${selectedRun.status === "completed" ? "text-green-700" : "text-yellow-700"}`}>{selectedRun.status === "completed" ? "Завершён" : "Частично"}</span></span>
          <span>Операторов: <span className="font-medium text-gray-700">{selectedRun.successCount}/{selectedRun.totalOperators}</span></span>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Загрузка...</div>
      ) : tariffs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400 text-sm">
          {runs.length === 0
            ? "Запусков нет. Нажмите «Инициализировать БД», затем «Запустить сбор» на дашборде."
            : "Тарифов не найдено для выбранного запуска."}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                <th className="text-left px-3 py-2 font-medium sticky left-0 bg-gray-50">Оператор</th>
                <th className="text-left px-3 py-2 font-medium">Тариф</th>
                <th className="text-left px-3 py-2 font-medium">Сегмент</th>
                <th className="text-right px-3 py-2 font-medium">₽/мес</th>
                <th className="text-right px-3 py-2 font-medium">ГБ</th>
                <th className="text-right px-3 py-2 font-medium">Мин</th>
                <th className="text-right px-3 py-2 font-medium">СМС</th>
                <th className="text-left px-3 py-2 font-medium">Сервисы</th>
                <th className="text-left px-3 py-2 font-medium">eSIM</th>
                <th className="text-left px-3 py-2 font-medium">Источник</th>
                <th className="text-left px-3 py-2 font-medium">Уверенность</th>
              </tr>
            </thead>
            <tbody>
              {tariffs.map((t) => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2 sticky left-0 bg-white">
                    <div className="font-medium text-gray-900 text-xs">{t.operator.name}</div>
                    <span className={`text-xs px-1 py-0.5 rounded ${t.operator.category === "MNO" ? "bg-purple-50 text-purple-600" : "bg-cyan-50 text-cyan-600"}`}>
                      {t.operator.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900 max-w-[180px]">
                    <div className="truncate" title={t.tariffName}>{t.tariffName}</div>
                    {t.collectionMethod === "ai-knowledge" && (
                      <div
                        className="text-xs text-yellow-600 cursor-help"
                        title="Данные получены из базы знаний ИИ — сайт оператора недоступен. Требуется ручная проверка."
                      >
                        ⚠ Не с сайта
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{t.segment ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">
                    {t.monthlyFeeRub ? `${t.monthlyFeeRub.toLocaleString("ru")} ₽` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {t.dataUnlimited ? "∞" : t.dataGb ? `${t.dataGb}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {t.voiceUnlimited ? "∞" : t.voiceMinutes ? `${t.voiceMinutes}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">{t.smsCount ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-gray-500 max-w-[140px]">
                    <div className="truncate" title={t.includedServices ?? ""}>{t.includedServices ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {t.esimAvailable === true ? "✓" : t.esimAvailable === false ? "✗" : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {t.sourceUrl ? (
                      <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="text-blue-500 hover:underline">ссылка</a>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {t.parserConfidence != null ? (
                      <span className={`px-1 py-0.5 rounded ${t.parserConfidence >= 0.8 ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                        {Math.round(t.parserConfidence * 100)}%
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tariffs.length > 0 && (
        <div className="flex gap-6 text-xs text-gray-400 pt-1">
          <span className="flex items-center gap-1">
            <span className="bg-green-50 text-green-700 px-1 rounded">85%</span>
            — данные получены с сайта оператора
          </span>
          <span className="flex items-center gap-1">
            <span className="text-yellow-600">⚠ Не с сайта</span>
            — сайт недоступен, данные из базы знаний ИИ (требуют проверки)
          </span>
        </div>
      )}
    </div>
  );
}
