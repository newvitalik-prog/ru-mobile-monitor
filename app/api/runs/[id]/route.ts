import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await prisma.collectionRun.findUnique({
    where: { id },
    include: {
      items: {
        include: { operator: { select: { name: true, category: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { tariffs: true, promotions: true } },
    },
  });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(run);
}
