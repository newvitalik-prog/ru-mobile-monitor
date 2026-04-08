import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const operatorId = searchParams.get("operatorId");
  const runId = searchParams.get("runId");

  const promotions = await prisma.promotionSnapshot.findMany({
    where: {
      ...(operatorId ? { operatorId } : {}),
      ...(runId ? { runId } : {}),
    },
    include: { operator: { select: { name: true, category: true } } },
    orderBy: [{ operator: { name: "asc" } }, { collectedAt: "desc" }],
    take: 500,
  });
  return NextResponse.json(promotions);
}
