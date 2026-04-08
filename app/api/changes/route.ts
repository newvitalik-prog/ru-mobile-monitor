import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const currentRunId = searchParams.get("currentRunId");

  if (!currentRunId) {
    // Get two latest runs
    const runs = await prisma.collectionRun.findMany({
      where: { status: { in: ["completed", "partial"] } },
      orderBy: { startedAt: "desc" },
      take: 2,
    });
    if (runs.length < 2) return NextResponse.json({ changes: [], message: "Нужно минимум 2 успешных запуска для сравнения" });

    const [current, baseline] = runs;
    return computeChanges(current.id, baseline.id);
  }

  const runs = await prisma.collectionRun.findMany({
    where: { status: { in: ["completed", "partial"] } },
    orderBy: { startedAt: "desc" },
    take: 2,
  });
  if (runs.length < 2) return NextResponse.json({ changes: [], message: "Нужно минимум 2 успешных запуска" });

  const [current, baseline] = runs;
  return computeChanges(current.id, baseline.id);
}

async function computeChanges(currentRunId: string, baselineRunId: string) {
  const currentTariffs = await prisma.tariffSnapshot.findMany({
    where: { runId: currentRunId },
    include: { operator: { select: { name: true, category: true } } },
  });

  const baselineTariffs = await prisma.tariffSnapshot.findMany({
    where: { runId: baselineRunId },
    include: { operator: { select: { name: true, category: true } } },
  });

  const changes = [];

  // Find new tariffs
  for (const current of currentTariffs) {
    const baseline = baselineTariffs.find(
      (b) =>
        b.operatorId === current.operatorId &&
        b.tariffName.toLowerCase() === current.tariffName.toLowerCase()
    );

    if (!baseline) {
      changes.push({ type: "new", current, baseline: null });
    } else {
      const diff: Record<string, { old: unknown; new: unknown }> = {};
      if (baseline.monthlyFeeRub !== current.monthlyFeeRub)
        diff.monthlyFeeRub = { old: baseline.monthlyFeeRub, new: current.monthlyFeeRub };
      if (baseline.dataGb !== current.dataGb)
        diff.dataGb = { old: baseline.dataGb, new: current.dataGb };
      if (baseline.voiceMinutes !== current.voiceMinutes)
        diff.voiceMinutes = { old: baseline.voiceMinutes, new: current.voiceMinutes };
      if (baseline.smsCount !== current.smsCount)
        diff.smsCount = { old: baseline.smsCount, new: current.smsCount };

      if (Object.keys(diff).length > 0) {
        changes.push({ type: "changed", current, baseline, diff });
      }
    }
  }

  // Find removed tariffs
  for (const baseline of baselineTariffs) {
    const current = currentTariffs.find(
      (c) =>
        c.operatorId === baseline.operatorId &&
        c.tariffName.toLowerCase() === baseline.tariffName.toLowerCase()
    );
    if (!current) {
      changes.push({ type: "removed", current: null, baseline });
    }
  }

  return NextResponse.json({
    currentRunId,
    baselineRunId,
    changes,
    summary: {
      new: changes.filter((c) => c.type === "new").length,
      changed: changes.filter((c) => c.type === "changed").length,
      removed: changes.filter((c) => c.type === "removed").length,
    },
  });
}
