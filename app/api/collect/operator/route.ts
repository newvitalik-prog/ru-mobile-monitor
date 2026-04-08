import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractTariffsWithAI, extractPromotionsWithAI, getTariffsFromAIKnowledge } from "@/lib/openrouter";
import type { TariffData } from "@/lib/openrouter";

export const maxDuration = 60;

type SourceRow = { id: string; sourceType: string; url: string; renderer: string };

/** Fixes common AI extraction errors before saving */
function normalizeTariff(t: TariffData): TariffData {
  // 1024 GB or more = AI encoded "unlimited" as a number
  const dataGb = (t.dataGb != null && t.dataGb >= 500) ? null : (t.dataGb ?? null);
  const dataUnlimited = t.dataUnlimited || (t.dataGb != null && t.dataGb >= 500);
  // 0 price = not found, treat as null
  const monthlyFeeRub = (t.monthlyFeeRub != null && t.monthlyFeeRub > 0) ? t.monthlyFeeRub : null;
  // 0 minutes = not found, treat as null
  const voiceMinutes = (t.voiceMinutes != null && t.voiceMinutes > 0) ? t.voiceMinutes : null;
  return { ...t, dataGb, dataUnlimited, monthlyFeeRub, voiceMinutes };
}

async function fetchPageViaJina(url: string): Promise<string | null> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const res = await fetch(jinaUrl, {
      headers: {
        Accept: "text/plain,text/html,*/*",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.7",
        "X-Return-Format": "text",
      },
      signal: AbortSignal.timeout(30000),
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

    // Try to fetch from site (skip ai-knowledge sources — go straight to fallback)
    let fetchedFromSite = false;
    const seenNames = new Set<string>(); // dedup across all sources for this operator+run
    const fetchableTariffSources = tariffSources.filter((s: SourceRow) => s.renderer !== "ai-knowledge");
    for (const source of fetchableTariffSources) {
      try {
        const html = await fetchPageViaJina(source.url);
        if (!html) continue;
        const tariffs = await extractTariffsWithAI(html, operator.name, source.url, model);
        if (tariffs.length > 0) {
          fetchedFromSite = true;
          for (const raw of tariffs) {
            const t = normalizeTariff(raw);
            const key = t.tariffName?.trim().toLowerCase();
            if (!key || seenNames.has(key)) continue;
            seenNames.add(key);
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

    // AI-knowledge fallback: when Jina fetch failed or all sources are renderer=ai-knowledge
    if (!fetchedFromSite && tariffSources.length > 0) {
      method = "ai-knowledge";
      try {
        const { tariffs, confidence } = await getTariffsFromAIKnowledge(operator.name, website, model);
        for (const raw of tariffs) {
          const t = normalizeTariff(raw);
          const key = t.tariffName?.trim().toLowerCase();
          if (!key || seenNames.has(key)) continue;
          seenNames.add(key);
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
        const html = await fetchPageViaJina(source.url);
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
