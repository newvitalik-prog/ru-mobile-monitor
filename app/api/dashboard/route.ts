import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [latestRun, totalOperators, settings] = await Promise.all([
    prisma.collectionRun.findFirst({
      orderBy: { startedAt: "desc" },
      include: { items: true, _count: { select: { tariffs: true, promotions: true } } },
    }),
    prisma.operator.count({ where: { active: true } }),
    prisma.appSettings.findFirst(),
  ]);

  const runs = await prisma.collectionRun.findMany({
    where: { status: { in: ["completed", "partial"] } },
    orderBy: { startedAt: "desc" },
    take: 5,
  });

  return NextResponse.json({
    latestRun,
    totalOperators,
    settings,
    recentRuns: runs,
  });
}
