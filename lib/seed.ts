import { prisma } from "./db";
import bcrypt from "bcryptjs";

const OPERATORS = [
  // MNO
  { name: "МТС", slug: "mts", category: "MNO", website: "https://www.mts.ru",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://www.mts.ru/personal/mobile/tariffs/", renderer: "ai" },
      { sourceType: "promotions", url: "https://www.mts.ru/personal/actions/", renderer: "ai" },
    ]
  },
  { name: "МегаФон", slug: "megafon", category: "MNO", website: "https://www.megafon.ru",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://www.megafon.ru/tariffs/", renderer: "ai" },
      { sourceType: "promotions", url: "https://www.megafon.ru/specials/", renderer: "ai" },
    ]
  },
  { name: "Билайн", slug: "beeline", category: "MNO", website: "https://beeline.ru",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://beeline.ru/customers/products/mobile/tariffs/", renderer: "ai" },
      { sourceType: "promotions", url: "https://beeline.ru/customers/products/mobile/tariffs/options/", renderer: "ai" },
    ]
  },
  { name: "Tele2 / T2", slug: "tele2", category: "MNO", website: "https://msk.tele2.ru",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://msk.tele2.ru/tariff", renderer: "ai" },
      { sourceType: "promotions", url: "https://msk.tele2.ru/action", renderer: "ai" },
    ]
  },
  // MVNO
  { name: "Yota", slug: "yota", category: "MVNO", website: "https://www.yota.ru",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://www.yota.ru/tariffs", renderer: "ai" },
    ]
  },
  { name: "Ростелеком Мобайл", slug: "rostelecom", category: "MVNO", website: "https://rt.ru",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://rt.ru/mobile/tariffs", renderer: "ai" },
    ]
  },
  { name: "Тинькофф Мобайл", slug: "tinkoff-mobile", category: "MVNO", website: "https://www.tinkoff.ru/mobile-operator/",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://www.tinkoff.ru/mobile-operator/tariffs/", renderer: "ai" },
    ]
  },
  { name: "СберМобайл", slug: "sbermobile", category: "MVNO", website: "https://www.sber.ru/mobile",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://www.sber.ru/mobile/tariffs", renderer: "ai" },
    ]
  },
  { name: "МОТИВ", slug: "motiv", category: "MVNO", website: "https://motivtelecom.ru",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://motivtelecom.ru/tariffs/", renderer: "ai" },
    ]
  },
  { name: "Ультра-Мобайл", slug: "ultra-mobile", category: "MVNO", website: "https://ultra-mobile.ru",
    sources: [
      { sourceType: "b2c_tariffs", url: "https://ultra-mobile.ru/tariff", renderer: "ai" },
    ]
  },
];

export async function seedDatabase() {
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
      const existingSource = await prisma.source.findFirst({
        where: { operatorId: operator.id, url: src.url },
      });
      if (!existingSource) {
        await prisma.source.create({
          data: { ...src, operatorId: operator.id },
        });
      }
    }
  }

  // Create default settings
  const settingsExist = await prisma.appSettings.findFirst();
  if (!settingsExist) {
    await prisma.appSettings.create({
      data: {
        scheduleEnabled: false,
        schedulePeriod: "weekly",
        scheduleDay: "monday",
        scheduleHour: 9,
        openrouterModel: "google/gemini-2.0-flash-lite-001",
      },
    });
  }

  return { ok: true };
}
