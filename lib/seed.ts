import { prisma } from "./db";
import bcrypt from "bcryptjs";

const OPERATORS = [
  // MNO
  { name: "МТС", slug: "mts", category: "MNO", website: "https://moskva.mts.ru",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://moskva.mts.ru/personal/mobilnaya-svyaz/tarifi/vse-tarifi/mobile", renderer: "jina" },
      { sourceType: "promotions", url: "https://moskva.mts.ru/personal/vse-akcii", renderer: "jina" },
    ]
  },
  { name: "МегаФон", slug: "megafon", category: "MNO", website: "https://moscow.megafon.ru",
    sources: [
      // МегаФон — SPA, Jina не получает данные; AI-knowledge fallback
      { sourceType: "b2c_tariffs", url: "https://moscow.megafon.ru/tariffs/", renderer: "ai-knowledge" },
    ]
  },
  { name: "Билайн", slug: "beeline", category: "MNO", website: "https://beeline.ru",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://beeline.ru/customers/products/mobile/tariffs/", renderer: "jina" },
    ]
  },
  { name: "Tele2 / T2", slug: "tele2", category: "MNO", website: "https://msk.tele2.ru",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://msk.tele2.ru/tariff", renderer: "jina" },
    ]
  },
  // MVNO
  { name: "Yota", slug: "yota", category: "MVNO", website: "https://www.yota.ru",
    sources: [
      // Yota — конструктор тарифов, нет фиксированных планов; AI-knowledge
      { sourceType: "b2c_tariffs", url: "https://www.yota.ru/", renderer: "ai-knowledge" },
    ]
  },
  { name: "Ростелеком Мобайл", slug: "rostelecom", category: "MVNO", website: "https://rt.ru",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://rt.ru/mobile/tariffs", renderer: "jina" },
    ]
  },
  { name: "Тинькофф Мобайл", slug: "tinkoff-mobile", category: "MVNO", website: "https://www.tinkoff.ru",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://www.tinkoff.ru/mobile-operator/tariffs/", renderer: "jina" },
    ]
  },
  { name: "СберМобайл", slug: "sbermobile", category: "MVNO", website: "https://www.sber.ru",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://www.sber.ru/sberbank/mobile/", renderer: "jina" },
    ]
  },
  { name: "МОТИВ", slug: "motiv", category: "MVNO", website: "https://motivtelecom.ru",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://motivtelecom.ru/tariffs/", renderer: "jina" },
    ]
  },
];

export async function seedDatabase() {
  // Purge old run data — keep only the latest completed/partial run to eliminate duplicates
  const latestRun = await prisma.collectionRun.findFirst({
    where: { status: { in: ["completed", "partial"] } },
    orderBy: { finishedAt: "desc" },
  });
  const runsToDelete = await prisma.collectionRun.findMany({
    where: latestRun ? { id: { not: latestRun.id } } : {},
    select: { id: true },
  });
  if (runsToDelete.length > 0) {
    const ids = runsToDelete.map((r) => r.id);
    await prisma.tariffSnapshot.deleteMany({ where: { runId: { in: ids } } });
    await prisma.promotionSnapshot.deleteMany({ where: { runId: { in: ids } } });
    await prisma.collectionRunItem.deleteMany({ where: { runId: { in: ids } } });
    await prisma.collectionRun.deleteMany({ where: { id: { in: ids } } });
  }

  // Create default admin user
  const existing = await prisma.user.findFirst();
  if (!existing) {
    const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD ?? "admin123", 10);
    await prisma.user.create({
      data: {
        email: process.env.ADMIN_EMAIL ?? "admin@example.com",
        password: hashed,
        name: "Администратор",
        role: "admin",
      },
    });
  }

  // Create operators and sources
  for (const op of OPERATORS) {
    const { sources, ...opData } = op;
    const operator = await prisma.operator.upsert({
      where: { slug: opData.slug },
      update: {},
      create: opData,
    });

    for (const src of sources) {
      // Match by sourceType (not URL) so URL/renderer changes are applied on re-seed
      const existingSource = await prisma.source.findFirst({
        where: { operatorId: operator.id, sourceType: src.sourceType },
      });
      if (existingSource) {
        await prisma.source.update({
          where: { id: existingSource.id },
          data: { url: src.url, renderer: src.renderer },
        });
      } else {
        await prisma.source.create({
          data: { ...src, operatorId: operator.id },
        });
      }
    }
  }

  // Create or update default settings
  const settingsExist = await prisma.appSettings.findFirst();
  if (!settingsExist) {
    await prisma.appSettings.create({
      data: {
        scheduleEnabled: false,
        schedulePeriod: "weekly",
        scheduleDay: "monday",
        scheduleHour: 9,
        openrouterModel: "google/gemini-2.5-flash-preview-05-20",
      },
    });
  } else {
    // Update model if it's the old default
    if (settingsExist.openrouterModel === "google/gemini-2.0-flash-lite-001") {
      await prisma.appSettings.update({
        where: { id: settingsExist.id },
        data: { openrouterModel: "google/gemini-2.5-flash-preview-05-20" },
      });
    }
  }

  return { ok: true };
}
