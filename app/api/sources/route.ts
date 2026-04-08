import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const sources = await prisma.source.findMany({
    include: { operator: { select: { name: true, category: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(sources);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const source = await prisma.source.create({ data: body });
  return NextResponse.json(source);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...data } = body;
  const source = await prisma.source.update({ where: { id }, data });
  return NextResponse.json(source);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  await prisma.source.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
