import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const operatorId = searchParams.get("operatorId");
  const search = searchParams.get("search");
  const runId = searchParams.get("runId");

  // If no runId — return list of available runs for the selector
  if (!runId) {
    const runs = await prisma.collectionRun.findMany({
      where: { status: { in: ["completed", "partial"] } },
      orderBy: { startedAt: "desc" },
      select: { id: true, status: true, startedAt: true, finishedAt: true, successCount: true, totalOperators: true },
      take: 20,
    });
    return NextResponse.json({ runs, tariffs: [] });
  }

  const tariffs = await prisma.tariffSnapshot.findMany({
    where: {
      runId,
      ...(operatorId ? { operatorId } : {}),
      ...(search ? { tariffName: { contains: search, mode: "insensitive" } } : {}),
    },
    include: { operator: { select: { name: true, category: true } } },
    orderBy: [{ operator: { name: "asc" } }, { monthlyFeeRub: "asc" }],
    take: 500,
  });
  return NextResponse.json({ runs: [], tariffs });
}
