import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  let settings = await prisma.appSettings.findFirst();
  if (!settings) {
    settings = await prisma.appSettings.create({
      data: {
        scheduleEnabled: false,
        schedulePeriod: "weekly",
        scheduleDay: "monday",
        scheduleHour: 9,
        openrouterModel: "google/gemini-flash-1.5-8b",
      },
    });
  }
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const existing = await prisma.appSettings.findFirst();

  if (existing) {
    const updated = await prisma.appSettings.update({
      where: { id: existing.id },
      data: body,
    });
    return NextResponse.json(updated);
  }

  const created = await prisma.appSettings.create({ data: body });
  return NextResponse.json(created);
}
