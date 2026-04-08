"use client";
import { useEffect, useState } from "react";

interface Settings {
  id: string;
  scheduleEnabled: boolean;
  schedulePeriod: string;
  scheduleDay: string;
  scheduleHour: number;
  openrouterModel: string;
  lastRunAt?: string;
}

const MODELS = [
  { value: "google/gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite (быстрый, дешёвый)" },
  { value: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash (рекомендуется)" },
  { value: "google/gemini-flash-1.5", label: "Gemini Flash 1.5" },
  { value: "anthropic/claude-3-haiku", label: "Claude 3 Haiku (быстрый)" },
  { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet (точный)" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini (дешёвый)" },
  { value: "openai/gpt-4o", label: "GPT-4o (точный)" },
  { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B (бесплатный)" },
];

const DAYS = [
  { value: "monday", label: "Понедельник" },
  { value: "tuesday", label: "Вторник" },
  { value: "wednesday", label: "Среда" },
  { value: "thursday", label: "Четверг" },
  { value: "friday", label: "Пятница" },
  { value: "saturday", label: "Суббота" },
  { value: "sunday", label: "Воскресенье" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading || !settings) return <div className="p-6 text-sm text-gray-500">Загрузка...</div>;

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Настройки</h1>
        <p className="text-sm text-gray-500">Расписание и параметры сбора данных</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-5">
        <h2 className="text-sm font-medium text-gray-700">Расписание</h2>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-900">Автоматический сбор</div>
            <div className="text-xs text-gray-500">Запускать по расписанию через Vercel Cron</div>
          </div>
          <button
            onClick={() => setSettings({ ...settings, scheduleEnabled: !settings.scheduleEnabled })}
            className={`relative w-10 h-5 rounded-full transition-colors ${settings.scheduleEnabled ? "bg-blue-600" : "bg-gray-300"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${settings.scheduleEnabled ? "left-5" : "left-0.5"}`} />
          </button>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Период</label>
          <select value={settings.schedulePeriod}
            onChange={(e) => setSettings({ ...settings, schedulePeriod: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
            <option value="daily">Ежедневно</option>
            <option value="weekly">Еженедельно</option>
            <option value="monthly">Ежемесячно</option>
          </select>
        </div>

        {settings.schedulePeriod === "weekly" && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">День недели</label>
            <select value={settings.scheduleDay}
              onChange={(e) => setSettings({ ...settings, scheduleDay: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
              {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-500 mb-1">Час запуска (МСК)</label>
          <select value={settings.scheduleHour}
            onChange={(e) => setSettings({ ...settings, scheduleHour: Number(e.target.value) })}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-medium text-gray-700">AI-парсер (OpenRouter)</h2>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Модель</label>
          <select value={settings.openrouterModel}
            onChange={(e) => setSettings({ ...settings, openrouterModel: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
            {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Ключ API задаётся в переменной окружения <code className="bg-gray-100 px-1 rounded">OPENROUTER_API_KEY</code>
          </p>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
        {saving ? "Сохраняю..." : saved ? "Сохранено ✓" : "Сохранить настройки"}
      </button>
    </div>
  );
}
