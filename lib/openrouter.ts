export interface TariffData {
  tariffName: string;
  monthlyFeeRub?: number;
  activationFeeRub?: number;
  dataGb?: number;
  dataUnlimited?: boolean;
  voiceMinutes?: number;
  voiceUnlimited?: boolean;
  smsCount?: number;
  includedServices?: string;
  esimAvailable?: boolean;
  segment?: string;
  remarks?: string;
}

export interface PromotionData {
  promotionName: string;
  promotionType?: string;
  mechanismSummary?: string;
  benefitValue?: string;
  startDate?: string;
  endDate?: string;
  restrictions?: string;
}

export async function extractTariffsWithAI(
  html: string,
  operatorName: string,
  sourceUrl: string,
  model: string = "google/gemini-flash-1.5-8b"
): Promise<TariffData[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY не задан");

  // Clean HTML: remove scripts, styles, keep text
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 60000);

  const prompt = `Ты — парсер тарифов российского мобильного оператора "${operatorName}".
Из текста ниже (это очищенный HTML страницы тарифов с сайта ${sourceUrl}) извлеки все тарифные планы для физических лиц.

Для каждого тарифа верни JSON объект с полями:
- tariffName: название тарифа (строка)
- monthlyFeeRub: абонентская плата в рублях в месяц (число, только цифры)
- activationFeeRub: стоимость подключения в рублях (число или null)
- dataGb: объём интернета в ГБ (число или null)
- dataUnlimited: безлимитный интернет (true/false)
- voiceMinutes: минуты звонков (число или null)
- voiceUnlimited: безлимитные звонки (true/false)
- smsCount: количество SMS (число или null)
- includedServices: дополнительные сервисы через запятую (строка или null)
- esimAvailable: поддержка eSIM (true/false/null)
- segment: сегмент — "b2c", "b2b", "prepaid", "postpaid" (строка или null)
- remarks: важные примечания (строка или null)

Верни ТОЛЬКО JSON массив объектов. Никаких пояснений. Если тарифов нет — верни пустой массив [].

Текст страницы:
${cleanHtml}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ru-mobile-monitor.vercel.app",
      "X-Title": "RU Mobile Tariffs Monitor",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 4000,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "[]";

  // Extract JSON from response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]) as TariffData[];
  } catch {
    return [];
  }
}

export async function extractPromotionsWithAI(
  html: string,
  operatorName: string,
  sourceUrl: string,
  model: string = "google/gemini-flash-1.5-8b"
): Promise<PromotionData[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY не задан");

  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 60000);

  const prompt = `Ты — парсер акций и специальных предложений российского мобильного оператора "${operatorName}".
Из текста ниже (это очищенный HTML страницы с сайта ${sourceUrl}) извлеки все активные акции, специальные предложения и промо.

Для каждой акции верни JSON объект с полями:
- promotionName: название акции (строка)
- promotionType: тип — "скидка", "бонус", "подарок", "кэшбэк", "рассрочка", "другое"
- mechanismSummary: краткое описание механики (строка или null)
- benefitValue: ценность предложения — например "50% скидка", "+10 ГБ", "500 руб" (строка или null)
- startDate: дата начала в формате YYYY-MM-DD (строка или null)
- endDate: дата окончания в формате YYYY-MM-DD (строка или null)
- restrictions: ограничения и условия (строка или null)

Верни ТОЛЬКО JSON массив. Никаких пояснений. Если акций нет — верни [].

Текст страницы:
${cleanHtml}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ru-mobile-monitor.vercel.app",
      "X-Title": "RU Mobile Tariffs Monitor",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 3000,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) return [];

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "[]";
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]) as PromotionData[];
  } catch {
    return [];
  }
}
