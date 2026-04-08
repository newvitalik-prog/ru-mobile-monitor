import { prisma } from "./db";
import {
  extractTariffsWithAI,
  extractPromotionsWithAI,
  getTariffsFromAIKnowledge,
} from "./openrouter";

type SourceRow = { id: string; sourceType: string; url: string };

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) return null;
    const text = await response.text();
    // Return null if page seems to be a bot-check or empty
    if (text.length < 500) return null;
    return text;
  } catch {
    return null;
  }
}

export async function runCollection(runId: string) {
  const settings = await prisma.appSettings.findFirst();
  const model = settings?.openrouterModel ?? "google/gemini-2.0-flash-lite";

  const operators = await prisma.operator.findMany({
    where: { active: true },
    include: { sources: { where: { isActive: true } } },
  });

  await prisma.collectionRun.update({
    where: { id: runId },
    data: { status: "running", totalOperators: operators.length },
  });

  let successCount = 0;
  let partialCount = 0;
  let failedCount = 0;

  for (const operator of operators) {
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

      // Try to collect tariffs from website first, fallback to AI knowledge
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
                  runId,
                  operatorId: operator.id,
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

      // AI knowledge fallback if site was not accessible
      if (!fetchedFromSite && tariffSources.length > 0) {
        method = "ai-knowledge";
        try {
          const { tariffs, confidence } = await getTariffsFromAIKnowledge(
            operator.name,
            website,
            model
          );
          for (const t of tariffs) {
            await prisma.tariffSnapshot.create({
              data: {
                runId,
                operatorId: operator.id,
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
                remarks: (t.remarks ? t.remarks + " | " : "") + "⚠ Данные из базы знаний AI (сайт недоступен с сервера)",
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

      // Collect promotions (try site, no AI-knowledge fallback for promos)
      for (const source of promoSources) {
        try {
          const html = await fetchPage(source.url);
          if (!html) continue;
          const promos = await extractPromotionsWithAI(html, operator.name, source.url, model);
          for (const p of promos) {
            await prisma.promotionSnapshot.create({
              data: {
                runId,
                operatorId: operator.id,
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
        } catch (e) {
          console.error(`Promo error for ${operator.name}:`, e);
        }
      }

      if (tariffsFound > 0) {
        itemStatus = method === "ai-knowledge" ? "partial" : "success";
        if (method === "ai-knowledge") {
          partialCount++;
        } else {
          successCount++;
        }
      } else if (errorMsg) {
        itemStatus = "failed";
        failedCount++;
      } else {
        itemStatus = "partial";
        partialCount++;
      }
    } catch (e) {
      errorMsg = String(e);
      itemStatus = "failed";
      failedCount++;
    }

    const durationMs = Date.now() - startTime;

    await prisma.collectionRunItem.create({
      data: {
        runId,
        operatorId: operator.id,
        status: itemStatus,
        method,
        errorMsg,
        tariffsFound,
        promoFound,
        durationMs,
      },
    });

    for (const source of operator.sources) {
      await prisma.source.update({
        where: { id: source.id },
        data: { lastVerifiedAt: new Date() },
      });
    }
  }

  await prisma.collectionRun.update({
    where: { id: runId },
    data: {
      status:
        successCount + partialCount === 0
          ? "failed"
          : partialCount > 0
          ? "partial"
          : "completed",
      finishedAt: new Date(),
      successCount,
      partialCount,
      failedCount,
    },
  });

  await prisma.appSettings.updateMany({
    data: { lastRunAt: new Date() },
  });
}
