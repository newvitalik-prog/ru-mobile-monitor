import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const operators = await prisma.operator.findMany({
    include: {
      sources: { where: { isActive: true } },
      _count: { select: { tariffs: true, promotions: true } },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(operators);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const operator = await prisma.operator.create({ data: body });
  return NextResponse.json(operator);
}
