import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "RU Mobile Tariffs Monitor",
  description: "Мониторинг тарифов российских мобильных операторов",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50 text-gray-900`}>
        {children}
      </body>
    </html>
  );
}
