import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const runs = await prisma.collectionRun.findMany({
    include: {
      items: {
        include: { operator: { select: { name: true } } },
      },
      _count: { select: { tariffs: true, promotions: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  return NextResponse.json(runs);
}
