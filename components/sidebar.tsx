"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Globe,
  Play,
  List,
  Tag,
  GitCompare,
  FileText,
  AlertTriangle,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Дашборд", icon: LayoutDashboard },
  { href: "/operators", label: "Операторы", icon: Building2 },
  { href: "/sources", label: "Источники", icon: Globe },
  { href: "/runs", label: "Запуски", icon: Play },
  { href: "/tariffs", label: "Тарифы", icon: List },
  { href: "/promotions", label: "Акции", icon: Tag },
  { href: "/changes", label: "Изменения", icon: GitCompare },
  { href: "/reports", label: "Отчёты", icon: FileText },
  { href: "/quality", label: "Качество данных", icon: AlertTriangle },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col min-h-screen">
      <div className="px-4 py-4 border-b border-gray-200">
        <div className="text-sm font-bold text-gray-900 leading-tight">RU Mobile</div>
        <div className="text-xs text-gray-500">Мониторинг тарифов</div>
      </div>
      <nav className="flex-1 py-2">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 px-4 py-2 text-sm transition-colors",
              pathname === href
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
