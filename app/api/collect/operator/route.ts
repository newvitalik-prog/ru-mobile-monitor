import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractTariffsWithAI, extractPromotionsWithAI, getTariffsFromAIKnowledge } from "@/lib/openrouter";

export const maxDuration = 60;

type SourceRow = { id: string; sourceType: string; url: string };

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.7",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length < 500) return null;
    return text;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { runId, operatorId } = await req.json();
  if (!runId || !operatorId) {
    return NextResponse.json({ error: "runId and operatorId required" }, { status: 400 });
  }

  const settings = await prisma.appSettings.findFirst();
  const model = settings?.openrouterModel ?? "google/gemini-2.0-flash-lite-001";

  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    include: { sources: { where: { isActive: true } } },
  });

  if (!operator) {
    return NextResponse.json({ error: "Operator not found" }, { status: 404 });
  }

  const startTime = Date.now();
  let tariffsFound = 0;
  let promoFound = 0;
  let method = "ai";
  let errorMsg: string | null = null;
  let itemStatus = "failed";

  try {
    const tariffSources = operator.sources.filter(
      (s: SourceRow) => s.sourceType === "b2c_tariffs" || s.sourceType === "landing"
    );
    const promoSources = operator.sources.filter(
      (s: SourceRow) => s.sourceType === "promotions"
    );
    const website = (operator as { website?: string }).website ?? tariffSources[0]?.url ?? "";

    // Try to fetch from site
    let fetchedFromSite = false;
    for (const source of tariffSources) {
      try {
        const html = await fetchPage(source.url);
        if (!html) continue;
        const tariffs = await extractTariffsWithAI(html, operator.name, source.url, model);
        if (tariffs.length > 0) {
          fetchedFromSite = true;
          for (const t of tariffs) {
            await prisma.tariffSnapshot.create({
              data: {
                runId, operatorId,
                tariffName: t.tariffName,
                monthlyFeeRub: t.monthlyFeeRub ?? null,
                activationFeeRub: t.activationFeeRub ?? null,
                dataGb: t.dataGb ?? null,
                dataUnlimited: t.dataUnlimited ?? false,
                voiceMinutes: t.voiceMinutes ?? null,
                voiceUnlimited: t.voiceUnlimited ?? false,
                smsCount: t.smsCount ?? null,
                includedServices: t.includedServices ?? null,
                esimAvailable: t.esimAvailable ?? null,
                segment: t.segment ?? null,
                remarks: t.remarks ?? null,
                sourceUrl: source.url,
                parserConfidence: 0.85,
                collectionMethod: "html+ai",
              },
            });
            tariffsFound++;
          }
        }
      } catch (e) {
        errorMsg = String(e);
      }
    }

    // AI-knowledge fallback
    if (!fetchedFromSite && tariffSources.length > 0) {
      method = "ai-knowledge";
      try {
        const { tariffs, confidence } = await getTariffsFromAIKnowledge(operator.name, website, model);
        for (const t of tariffs) {
          await prisma.tariffSnapshot.create({
            data: {
              runId, operatorId,
              tariffName: t.tariffName,
              monthlyFeeRub: t.monthlyFeeRub ?? null,
              activationFeeRub: t.activationFeeRub ?? null,
              dataGb: t.dataGb ?? null,
              dataUnlimited: t.dataUnlimited ?? false,
              voiceMinutes: t.voiceMinutes ?? null,
              voiceUnlimited: t.voiceUnlimited ?? false,
              smsCount: t.smsCount ?? null,
              includedServices: t.includedServices ?? null,
              esimAvailable: t.esimAvailable ?? null,
              segment: t.segment ?? null,
              remarks: (t.remarks ? t.remarks + " | " : "") + "⚠ Данные из базы знаний AI",
              sourceUrl: website,
              parserConfidence: confidence,
              collectionMethod: "ai-knowledge",
            },
          });
          tariffsFound++;
        }
        if (tariffs.length > 0) errorMsg = null;
      } catch (e) {
        errorMsg = errorMsg ?? String(e);
      }
    }

    // Promotions
    for (const source of promoSources) {
      try {
        const html = await fetchPage(source.url);
        if (!html) continue;
        const promos = await extractPromotionsWithAI(html, operator.name, source.url, model);
        for (const p of promos) {
          await prisma.promotionSnapshot.create({
            data: {
              runId, operatorId,
              promotionName: p.promotionName,
              promotionType: p.promotionType ?? null,
              mechanismSummary: p.mechanismSummary ?? null,
              benefitValue: p.benefitValue ?? null,
              startDate: p.startDate ? new Date(p.startDate) : null,
              endDate: p.endDate ? new Date(p.endDate) : null,
              restrictions: p.restrictions ?? null,
              sourceUrl: source.url,
              parserConfidence: 0.75,
              collectionMethod: "html+ai",
            },
          });
          promoFound++;
        }
      } catch {}
    }

    itemStatus = tariffsFound > 0
      ? (method === "ai-knowledge" ? "partial" : "success")
      : errorMsg ? "failed" : "partial";

  } catch (e) {
    errorMsg = String(e);
    itemStatus = "failed";
  }

  const durationMs = Date.now() - startTime;

  await prisma.collectionRunItem.create({
    data: { runId, operatorId, status: itemStatus, method, errorMsg, tariffsFound, promoFound, durationMs },
  });

  for (const source of operator.sources) {
    await prisma.source.update({ where: { id: source.id }, data: { lastVerifiedAt: new Date() } });
  }

  return NextResponse.json({ operatorId, status: itemStatus, tariffsFound, promoFound, method });
}
