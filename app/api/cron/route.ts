import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runCollection } from "@/lib/collector";

// Called by Vercel Cron — secured by CRON_SECRET
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.appSettings.findFirst();
  if (!settings?.scheduleEnabled) {
    return NextResponse.json({ message: "Расписание отключено" });
  }

  const running = await prisma.collectionRun.findFirst({
    where: { status: "running" },
  });
  if (running) {
    return NextResponse.json({ message: "Сбор уже запущен" });
  }

  const run = await prisma.collectionRun.create({
    data: { status: "pending", triggerType: "scheduled" },
  });

  runCollection(run.id).catch(console.error);

  return NextResponse.json({ runId: run.id, status: "started" });
}
