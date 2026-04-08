import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { runId } = await req.json();
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

  const items = await prisma.collectionRunItem.findMany({ where: { runId } });
  const successCount = items.filter((i) => i.status === "success").length;
  const partialCount = items.filter((i) => i.status === "partial").length;
  const failedCount = items.filter((i) => i.status === "failed").length;

  const status =
    successCount + partialCount === 0 ? "failed" : partialCount > 0 ? "partial" : "completed";

  const run = await prisma.collectionRun.update({
    where: { id: runId },
    data: { status, finishedAt: new Date(), successCount, partialCount, failedCount },
  });

  await prisma.appSettings.updateMany({ data: { lastRunAt: new Date() } });

  return NextResponse.json({ runId, status, successCount, partialCount, failedCount });
}
