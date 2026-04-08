import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const operatorId = searchParams.get("operatorId");
  const runId = searchParams.get("runId");
  const search = searchParams.get("search");

  const tariffs = await prisma.tariffSnapshot.findMany({
    where: {
      ...(operatorId ? { operatorId } : {}),
      ...(runId ? { runId } : {}),
      ...(search
        ? { tariffName: { contains: search, mode: "insensitive" } }
        : {}),
    },
    include: { operator: { select: { name: true, category: true } } },
    orderBy: [{ operator: { name: "asc" } }, { monthlyFeeRub: "asc" }],
    take: 500,
  });
  return NextResponse.json(tariffs);
}
