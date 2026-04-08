import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const operatorId = searchParams.get("operatorId");
  const runId = searchParams.get("runId");

  if (!runId) {
    const runs = await prisma.collectionRun.findMany({
      where: { status: { in: ["completed", "partial"] } },
      orderBy: { startedAt: "desc" },
      select: { id: true, status: true, startedAt: true, successCount: true, totalOperators: true },
      take: 20,
    });
    return NextResponse.json({ runs, promotions: [] });
  }

  const promotions = await prisma.promotionSnapshot.findMany({
    where: {
      runId,
      ...(operatorId ? { operatorId } : {}),
    },
    include: { operator: { select: { name: true, category: true } } },
    orderBy: [{ operator: { name: "asc" } }, { collectedAt: "desc" }],
    take: 500,
  });
  return NextResponse.json({ runs: [], promotions });
}
