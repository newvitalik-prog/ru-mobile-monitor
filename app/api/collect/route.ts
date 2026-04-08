import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST() {
  const running = await prisma.collectionRun.findFirst({
    where: { status: "running" },
  });
  if (running) {
    return NextResponse.json(
      { error: "Сбор уже запущен", runId: running.id },
      { status: 409 }
    );
  }

  const operators = await prisma.operator.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });

  const run = await prisma.collectionRun.create({
    data: {
      status: "running",
      triggerType: "manual",
      totalOperators: operators.length,
    },
  });

  return NextResponse.json({
    runId: run.id,
    status: "started",
    operators: operators.map((o) => o.id),
  });
}
