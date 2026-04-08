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

const DEFAULT_MODEL = "google/gemini-2.5-flash";

async function callOpenRouter(model: string, prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY не задан");

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
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "[]";
}

function parseJsonArray(content: string): unknown[] {
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try { return JSON.parse(match[0]); } catch { return []; }
}

function cleanPageText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 60000);
}

export async function extractTariffsWithAI(
  html: string,
  operatorName: string,
  sourceUrl: string,
  model: string = DEFAULT_MODEL
): Promise<TariffData[]> {
  const text = cleanPageText(html);

  const prompt = `Ты — точный парсер тарифов мобильной связи. Оператор: "${operatorName}". Источник: ${sourceUrl}

ЗАДАЧА: извлечь только тарифы мобильной связи для физических лиц.

СТРОГИЕ ПРАВИЛА — нарушение любого правила делает данные бесполезными:
1. Используй ТОЛЬКО названия тарифов, которые ДОСЛОВНО написаны в тексте ниже. ЗАПРЕЩЕНО придумывать или изменять названия.
2. ИСКЛЮЧИ: тарифы для бизнеса (B2B), домашний интернет (содержат слова "Дома", "Домашний", "Дом", "Home"), роуминг, планшеты, модемы, устройства, архивные тарифы.
3. monthlyFeeRub — ТОЛЬКО если цена явно написана в тексте рядом с тарифом (число + ₽ или руб). Иначе null. НИКОГДА не угадывай цену.
4. Каждый тариф — ровно ОДИН РАЗ. Дубли запрещены.
5. dataUnlimited: true → dataGb: null. НИКОГДА не пиши 1024 или другое большое число вместо безлимита.
6. Нулевые значения (0 ₽, 0 мин) — записывай как null, а не 0.
7. Не включай тарифы, у которых нет ни названия, ни цены.

Поля JSON объекта:
- tariffName: дословное название из текста
- monthlyFeeRub: число или null
- activationFeeRub: число или null
- dataGb: число или null
- dataUnlimited: true/false
- voiceMinutes: число или null
- voiceUnlimited: true/false
- smsCount: число или null
- includedServices: строка или null
- esimAvailable: true/false/null
- segment: "prepaid"/"postpaid"/null
- remarks: строка или null

Верни ТОЛЬКО JSON массив []. Никакого текста вокруг.

Текст страницы:
${text}`;

  const content = await callOpenRouter(model, prompt, 4000);
  return parseJsonArray(content) as TariffData[];
}

export async function extractPromotionsWithAI(
  html: string,
  operatorName: string,
  sourceUrl: string,
  model: string = DEFAULT_MODEL
): Promise<PromotionData[]> {
  const text = cleanPageText(html);

  const prompt = `Ты — парсер акций российского мобильного оператора "${operatorName}". Источник: ${sourceUrl}

Извлеки только активные акции и спецпредложения для физлиц. Используй ТОЛЬКО то, что написано в тексте.

Поля JSON:
- promotionName: название акции из текста
- promotionType: "скидка"/"бонус"/"подарок"/"кэшбэк"/"рассрочка"/"другое"
- mechanismSummary: краткое описание механики (строка или null)
- benefitValue: ценность — "50% скидка", "+10 ГБ", "500 руб" (строка или null)
- startDate: YYYY-MM-DD или null
- endDate: YYYY-MM-DD или null
- restrictions: ограничения (строка или null)

Верни ТОЛЬКО JSON массив []. Если акций нет — [].

Текст страницы:
${text}`;

  try {
    const content = await callOpenRouter(model, prompt, 3000);
    return parseJsonArray(content) as PromotionData[];
  } catch {
    return [];
  }
}

// AI fallback when operator site is blocked/unavailable
export async function getTariffsFromAIKnowledge(
  operatorName: string,
  operatorWebsite: string,
  model: string = DEFAULT_MODEL
): Promise<{ tariffs: TariffData[]; confidence: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { tariffs: [], confidence: 0 };

  const prompt = `Ты — эксперт по тарифам российских мобильных операторов.

Перечисли ТОЛЬКО реально существующие тарифы оператора "${operatorName}" (сайт: ${operatorWebsite}) для физических лиц.

КРИТИЧЕСКИ ВАЖНО:
- Включай тариф ТОЛЬКО если ты уверен в его существовании и точном названии.
- НЕ ВЫДУМЫВАЙ тарифы, названия, цены. Лучше включить меньше, но точно.
- Не включай тарифы с датами в названии (например "Тариф_04_2024").
- Не включай общие описания ("Безлимитный интернет") — только реальные брендированные названия.
- Если оператор использует конструктор тарифов (Yota, Ростелеком) — верни 1 запись с описанием конструктора.
- Цены указывай только если уверен. Неизвестную цену — null.
- Не указывай диапазоны цен (например "250-350") — только конкретное число или null.

Поля JSON:
- tariffName: точное брендированное название тарифа
- monthlyFeeRub: число или null
- dataGb: число или null
- dataUnlimited: true/false
- voiceMinutes: число или null
- voiceUnlimited: true/false
- smsCount: число или null
- includedServices: строка или null
- segment: "prepaid"/"postpaid"/null
- remarks: важные условия; добавь "⚠ данные из базы знаний AI, требуют проверки"

Верни ТОЛЬКО JSON массив [].`;

  try {
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

    if (!response.ok) return { tariffs: [], confidence: 0 };

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "[]";
    const tariffs = parseJsonArray(content) as TariffData[];
    return { tariffs, confidence: 0.4 };
  } catch {
    return { tariffs: [], confidence: 0 };
  }
}
