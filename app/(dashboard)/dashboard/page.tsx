"use client";
import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Play, RefreshCw, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";

interface DashboardData {
  latestRun: {
    id: string; status: string; startedAt: string; finishedAt?: string;
    successCount: number; partialCount: number; failedCount: number;
    totalOperators: number; triggerType: string;
    _count: { tariffs: number; promotions: number };
  } | null;
  totalOperators: number;
  settings: { scheduleEnabled: boolean; schedulePeriod: string } | null;
  recentRuns: Array<{ id: string; status: string; startedAt: string; successCount: number }>;
}

interface CollectProgress {
  total: number; done: number; tariffs: number;
  operatorResults: Record<string, { status: string; tariffsFound: number }>;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  completed: { label: "Завершён", color: "text-green-700 bg-green-50", icon: <CheckCircle2 className="h-4 w-4" /> },
  partial:   { label: "Частично", color: "text-yellow-700 bg-yellow-50", icon: <AlertCircle className="h-4 w-4" /> },
  failed:    { label: "Ошибка",   color: "text-red-700 bg-red-50",       icon: <XCircle className="h-4 w-4" /> },
  running:   { label: "Выполняется", color: "text-blue-700 bg-blue-50", icon: <RefreshCw className="h-4 w-4 animate-spin" /> },
  pending:   { label: "Ожидание", color: "text-gray-700 bg-gray-50",    icon: <Clock className="h-4 w-4" /> },
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<CollectProgress | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [msg, setMsg] = useState("");
  const collectingRef = useRef(false);

  const load = async () => {
    try {
      const r = await fetch("/api/dashboard");
      setData(await r.json());
    } catch {
      setMsg("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSeed = async () => {
    setSeeding(true); setMsg("");
    try {
      const r = await fetch("/api/seed", { method: "POST" });
      if (r.ok) { setMsg("БД инициализирована. Теперь запустите сбор."); load(); }
    } finally { setSeeding(false); }
  };

  const handleCollect = async () => {
    if (collectingRef.current) return;
    collectingRef.current = true;
    setMsg(""); setProgress(null);

    try {
      // 1. Start run, get operator list
      const startRes = await fetch("/api/collect", { method: "POST" });
      const startData = await startRes.json();
      if (!startRes.ok) { setMsg(startData.error ?? "Ошибка запуска"); return; }

      const { runId, operators: operatorIds } = startData;
      const total = operatorIds.length;
      setProgress({ total, done: 0, tariffs: 0, operatorResults: {} });
      setMsg(`Запуск: обрабатываем ${total} операторов параллельно...`);

      // 2. Process all operators in parallel (batches of 5)
      const results: CollectProgress["operatorResults"] = {};
      let totalTariffs = 0;
      const batchSize = 4;

      for (let i = 0; i < operatorIds.length; i += batchSize) {
        const batch = operatorIds.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (opId: string) => {
            const r = await fetch("/api/collect/operator", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ runId, operatorId: opId }),
            });
            return r.ok ? await r.json() : { operatorId: opId, status: "failed", tariffsFound: 0 };
          })
        );

        for (const res of batchResults) {
          results[res.operatorId] = { status: res.status, tariffsFound: res.tariffsFound };
          totalTariffs += res.tariffsFound ?? 0;
        }

        setProgress({
          total, done: Math.min(i + batchSize, total),
          tariffs: totalTariffs, operatorResults: { ...results },
        });
      }

      // 3. Finish run
      await fetch("/api/collect/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });

      setMsg(`Сбор завершён! Собрано ${totalTariffs} тарифов.`);
      load();
    } finally {
      collectingRef.current = false;
    }
  };

  const isCollecting = collectingRef.current || progress !== null && progress.done < progress.total;
  const run = data?.latestRun;
  const status = run ? STATUS_MAP[run.status] ?? STATUS_MAP.pending : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Дашборд</h1>
          <p className="text-sm text-gray-500">Мониторинг тарифов российских мобильных операторов</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSeed} disabled={seeding}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
            {seeding ? "Инициализация..." : "Инициализировать БД"}
          </button>
          <button onClick={handleCollect} disabled={isCollecting}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {isCollecting
              ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Сбор...</>
              : <><Play className="h-3.5 w-3.5" /> Запустить сбор</>}
          </button>
        </div>
      </div>

      {msg && (
        <div className="text-sm p-3 bg-blue-50 text-blue-800 rounded-md border border-blue-200">{msg}</div>
      )}

      {/* Live progress */}
      {progress && (
        <div className="bg-white rounded-lg border border-blue-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Прогресс сбора</span>
            <span className="text-sm text-gray-500">{progress.done}/{progress.total} операторов</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
            <div className="bg-blue-600 h-1.5 rounded-full transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <div className="text-xs text-gray-500">Тарифов собрано: <span className="font-medium text-gray-900">{progress.tariffs}</span></div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Загрузка...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Операторов" value={data?.totalOperators ?? 0} />
            <KpiCard label="Тарифов собрано" value={run?._count.tariffs ?? 0} />
            <KpiCard label="Акций собрано" value={run?._count.promotions ?? 0} />
            <KpiCard label="Успешных" value={run ? `${run.successCount + run.partialCount}/${run.totalOperators}` : "—"} />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Последний запуск</h2>
            {run ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${status?.color}`}>
                    {status?.icon}{status?.label}
                  </span>
                  <span className="text-xs text-gray-500">
                    {format(new Date(run.startedAt), "d MMMM yyyy, HH:mm", { locale: ru })}
                  </span>
                  <span className="text-xs text-gray-400">{run.triggerType === "manual" ? "вручную" : "по расписанию"}</span>
                </div>
                <div className="flex gap-6 text-sm">
                  <span className="text-green-700">✓ Успешно: {run.successCount}</span>
                  <span className="text-yellow-700">~ Частично: {run.partialCount}</span>
                  <span className="text-red-700">✗ Ошибка: {run.failedCount}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                Запусков ещё не было. Нажмите &quot;Инициализировать БД&quot;, затем &quot;Запустить сбор&quot;.
              </div>
            )}
          </div>

          {data && data.recentRuns.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-3">История запусков</h2>
              <div className="space-y-2">
                {data.recentRuns.map((r) => {
                  const s = STATUS_MAP[r.status] ?? STATUS_MAP.pending;
                  return (
                    <div key={r.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${s.color}`}>
                          {s.icon} {s.label}
                        </span>
                        <span className="text-gray-600">
                          {format(new Date(r.startedAt), "d MMM, HH:mm", { locale: ru })}
                        </span>
                      </div>
                      <span className="text-gray-500">Успешно: {r.successCount}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
