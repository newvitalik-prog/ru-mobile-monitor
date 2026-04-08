import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const operatorId = searchParams.get("operatorId");

  let runId = searchParams.get("runId");
  if (!runId) {
    const latestRun = await prisma.collectionRun.findFirst({
      where: { status: { in: ["completed", "partial"] } },
      orderBy: { finishedAt: "desc" },
    });
    runId = latestRun?.id ?? null;
  }

  if (!runId) return NextResponse.json([]);

  const promotions = await prisma.promotionSnapshot.findMany({
    where: {
      runId,
      ...(operatorId ? { operatorId } : {}),
    },
    include: { operator: { select: { name: true, category: true } } },
    orderBy: [{ operator: { name: "asc" } }, { collectedAt: "desc" }],
    take: 500,
  });
  return NextResponse.json(promotions);
}
