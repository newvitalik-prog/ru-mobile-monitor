import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const operatorId = searchParams.get("operatorId");
  const search = searchParams.get("search");

  // Use explicit runId or default to the latest completed/partial run
  let runId = searchParams.get("runId");
  if (!runId) {
    const latestRun = await prisma.collectionRun.findFirst({
      where: { status: { in: ["completed", "partial"] } },
      orderBy: { finishedAt: "desc" },
    });
    runId = latestRun?.id ?? null;
  }

  if (!runId) return NextResponse.json([]);

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
  return NextResponse.json(tariffs);
}
