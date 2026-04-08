"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Operator {
  id: string;
  name: string;
  slug: string;
  category: string;
  website?: string;
  active: boolean;
  sources: Array<{ id: string; sourceType: string; isActive: boolean }>;
  _count: { tariffs: number; promotions: number };
  updatedAt: string;
}

export default function OperatorsPage() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/operators")
      .then((r) => r.json())
      .then(setOperators)
      .finally(() => setLoading(false));
  }, []);

  const mno = operators.filter((o) => o.category === "MNO");
  const mvno = operators.filter((o) => o.category === "MVNO");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Операторы</h1>
        <p className="text-sm text-gray-500">{operators.length} операторов в реестре</p>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Загрузка...</div>
      ) : (
        <>
          <OperatorTable title="Федеральные МНО" operators={mno} />
          <OperatorTable title="МВНО" operators={mvno} />
        </>
      )}
    </div>
  );
}

function OperatorTable({ title, operators }: { title: string; operators: Operator[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-medium text-gray-700">{title} ({operators.length})</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-100">
              <th className="text-left px-4 py-2 font-medium">Оператор</th>
              <th className="text-left px-4 py-2 font-medium">Категория</th>
              <th className="text-left px-4 py-2 font-medium">Источников</th>
              <th className="text-left px-4 py-2 font-medium">Тарифов</th>
              <th className="text-left px-4 py-2 font-medium">Акций</th>
              <th className="text-left px-4 py-2 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody>
            {operators.map((op) => (
              <tr key={op.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">
                  {op.website ? (
                    <a href={op.website} target="_blank" rel="noopener noreferrer"
                      className="hover:text-blue-600">{op.name}</a>
                  ) : op.name}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    op.category === "MNO" ? "bg-purple-50 text-purple-700" : "bg-cyan-50 text-cyan-700"
                  }`}>
                    {op.category}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-600">{op.sources.length}</td>
                <td className="px-4 py-2.5 text-gray-600">{op._count.tariffs}</td>
                <td className="px-4 py-2.5 text-gray-600">{op._count.promotions}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    op.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {op.active ? "Активен" : "Неактивен"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
