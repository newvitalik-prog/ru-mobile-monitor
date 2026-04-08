import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runCollection } from "@/lib/collector";

export async function POST() {
  // Check if already running
  const running = await prisma.collectionRun.findFirst({
    where: { status: "running" },
  });
  if (running) {
    return NextResponse.json(
      { error: "Сбор уже запущен", runId: running.id },
      { status: 409 }
    );
  }

  // Create run record
  const run = await prisma.collectionRun.create({
    data: { status: "pending", triggerType: "manual" },
  });

  // Start async (don't await — return immediately)
  runCollection(run.id).catch((e) => {
    console.error("Collection error:", e);
    prisma.collectionRun.update({
      where: { id: run.id },
      data: { status: "failed", finishedAt: new Date() },
    });
  });

  return NextResponse.json({ runId: run.id, status: "started" });
}
