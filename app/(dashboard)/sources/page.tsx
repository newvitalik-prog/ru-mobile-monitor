"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";

interface Source {
  id: string;
  operatorId: string;
  operator: { name: string; category: string };
  sourceType: string;
  url: string;
  renderer: string;
  trustLevel: string;
  isActive: boolean;
  notes?: string;
}

interface Operator { id: string; name: string; category: string }

const SOURCE_TYPE_LABELS: Record<string, string> = {
  b2c_tariffs: "Тарифы B2C",
  b2b_tariffs: "Тарифы B2B",
  promotions: "Акции",
  archives: "Архив",
  landing: "Лендинг",
  legal: "Правовые",
};

const RENDERER_LABELS: Record<string, string> = {
  http: "HTTP",
  ai: "AI-парсер",
  playwright: "Playwright",
  manual_review: "Ручная проверка",
};

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    operatorId: "", sourceType: "b2c_tariffs", url: "", renderer: "ai",
    trustLevel: "official_confirmed", isActive: true, notes: "",
  });

  const load = () => {
    Promise.all([
      fetch("/api/sources").then((r) => r.json()),
      fetch("/api/operators").then((r) => r.json()),
    ]).then(([s, o]) => {
      setSources(s);
      setOperators(o);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false);
    setForm({ operatorId: "", sourceType: "b2c_tariffs", url: "", renderer: "ai", trustLevel: "official_confirmed", isActive: true, notes: "" });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить источник?")) return;
    await fetch(`/api/sources?id=${id}`, { method: "DELETE" });
    load();
  };

  const toggleActive = async (source: Source) => {
    await fetch("/api/sources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: source.id, isActive: !source.isActive }),
    });
    load();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Источники данных</h1>
          <p className="text-sm text-gray-500">{sources.length} источников</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" /> Добавить источник
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Новый источник</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Оператор</label>
              <select value={form.operatorId} onChange={(e) => setForm({ ...form, operatorId: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" required>
                <option value="">Выберите оператора</option>
                {operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Тип источника</label>
              <select value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                {Object.entries(SOURCE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">URL</label>
              <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..." className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Метод парсинга</label>
              <select value={form.renderer} onChange={(e) => setForm({ ...form, renderer: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                {Object.entries(RENDERER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Примечания</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Сохранить</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Отмена</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Загрузка...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left px-4 py-2 font-medium">Оператор</th>
                <th className="text-left px-4 py-2 font-medium">Тип</th>
                <th className="text-left px-4 py-2 font-medium">URL</th>
                <th className="text-left px-4 py-2 font-medium">Метод</th>
                <th className="text-left px-4 py-2 font-medium">Статус</th>
                <th className="text-left px-4 py-2 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((src) => (
                <tr key={src.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{src.operator.name}</td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{SOURCE_TYPE_LABELS[src.sourceType] ?? src.sourceType}</td>
                  <td className="px-4 py-2.5 max-w-xs">
                    <a href={src.url} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs truncate block">{src.url}</a>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      {RENDERER_LABELS[src.renderer] ?? src.renderer}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => toggleActive(src)}
                      className={`text-xs px-1.5 py-0.5 rounded cursor-pointer ${src.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {src.isActive ? "Активен" : "Выключен"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => handleDelete(src.id)} className="text-gray-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
