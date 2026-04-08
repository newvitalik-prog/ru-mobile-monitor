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

ЗАДАЧА: извлечь тарифы мобильной связи для физических лиц с точными данными.

СТРОГИЕ ПРАВИЛА:
1. Названия — ТОЛЬКО дословно из текста. Не придумывай и не изменяй.
2. ИСКЛЮЧИ: B2B, домашний интернет ("Дома", "Домашний", "Дом", "Home"), роуминг, планшеты, модемы, архивные тарифы.
3. monthlyFeeRub — только если цена прямо написана рядом с тарифом (число + ₽/руб). Иначе null.
   - Если есть и акционная и обычная цена — бери ОБЫЧНУЮ (полную) цену. Акционную указывай в remarks.
   - Если цена указана за неделю (₽/неделю) — переводи в месяц (×4) и отмечай в remarks "цена за неделю".
   - Зачёркнутая цена — это обычная цена. Цена с пометкой "при новом подключении", "при переходе" — акционная.
4. Каждый тариф — ровно один раз. Дубли запрещены.
5. Нулевые значения (0 ₽, 0 мин) → null.
6. КРИТИЧНО — не путай тарифы с компонентами конструктора: если страница показывает выбор пакетов ("10 ГБ", "20 ГБ", "200 минут", "0 минут", "Безлимитные СМС") — это опции, НЕ тарифы. Тариф обязан иметь собственное брендированное НАЗВАНИЕ (например "RED", "Безлимит на всё", "МОЙ ОНЛАЙН"), а не просто объём или число.

КРИТИЧЕСКИ ВАЖНО — интернет:
- dataUnlimited: true ТОЛЬКО если ВЕСЬ мобильный трафик безлимитный.
- Если безлимит только на конкретные приложения/сервисы (соцсети, мессенджеры, музыка и т.п.) — это НЕ dataUnlimited. Пиши dataUnlimited: false, фактический объём ГБ в dataGb, а названия приложений — в includedServices.
- "Безлимит на Telegram, VK, YouTube" → dataUnlimited: false, includedServices: "безлимит: Telegram, VK, YouTube"
- Если тариф даёт X ГБ + бонусные ГБ каждый месяц — суммируй или указывай базовый объём в dataGb.

КРИТИЧЕСКИ ВАЖНО — голос:
- voiceUnlimited: true ТОЛЬКО если звонки безлимитны на ВСЕ номера России всех операторов.
- "Безлимит на номера своего оператора" или "безлимит внутри сети" — это НЕ voiceUnlimited. Пиши voiceUnlimited: false, минуты на другие сети в voiceMinutes, условие в remarks.
- "100 минут + безлимит на Т2" → voiceMinutes: 100, voiceUnlimited: false, remarks: "безлимит на номера Т2"

Поля JSON:
- tariffName: дословное название
- monthlyFeeRub: число или null
- activationFeeRub: число или null
- dataGb: общий объём ГБ или null
- dataUnlimited: true только если ВЕСЬ трафик безлимитен
- voiceMinutes: минуты на все сети или null
- voiceUnlimited: true только если все звонки по России безлимитны
- smsCount: число или null
- includedServices: безлимитные приложения, бонусы, сервисы (строка или null)
- esimAvailable: true/false/null
- segment: "prepaid"/"postpaid"/null
- remarks: особые условия, ограничения (строка или null)

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

ОБЩИЕ ПРАВИЛА:
- Включай тариф ТОЛЬКО если уверен в названии. Лучше меньше, но точно.
- Не придумывай названия, не ставь даты в названиях, не давай общих описаний.
- Цены — только если уверен, иначе null. Без диапазонов ("250-350" → null).
- Тариф должен иметь БРЕНДИРОВАННОЕ НАЗВАНИЕ, а не просто объём: "10 ГБ", "200 минут" — это компоненты конструктора, не тарифы. Не включай их.

ЕСЛИ ОПЕРАТОР ИСПОЛЬЗУЕТ КОНСТРУКТОР ТАРИФОВ (например Yota):
- Не пиши одну строку "Конструктор тарифа" с прочерками — это бесполезно.
- Вместо этого перечисли 4-5 ТИПИЧНЫХ конфигураций с реальными примерными ценами.
- Называй их описательно: "Минимальный (5 ГБ, 0 мин)", "Базовый (15 ГБ, 100 мин)" и т.д.
- Указывай приблизительную цену если знаешь систему ценообразования оператора.
- В remarks обязательно пиши: "Пример конфигурации конструктора — точная цена на yota.ru"

ТОЧНОСТЬ ПО ИНТЕРНЕТУ — это частая ошибка:
- dataUnlimited: true ТОЛЬКО если ВЕСЬ мобильный трафик безлимитен.
- Если безлимит только на приложения (соцсети, мессенджеры) — dataUnlimited: false, объём ГБ в dataGb, приложения в includedServices.
- "Безлимит на Telegram, VK, YouTube, музыку" — это НЕ dataUnlimited.

ТОЧНОСТЬ ПО ГОЛОСУ:
- voiceUnlimited: true ТОЛЬКО если звонки безлимитны на ВСЕ номера России.
- "Безлимит внутри сети" или "безлимит на номера оператора" — voiceUnlimited: false, условие в remarks.

Поля JSON:
- tariffName: точное брендированное название
- monthlyFeeRub: число или null
- dataGb: объём ГБ или null
- dataUnlimited: true только если ВЕСЬ трафик безлимитен
- voiceMinutes: минуты на все сети или null
- voiceUnlimited: true только если все звонки по России безлимитны
- smsCount: число или null
- includedServices: безлимитные приложения, бонусы (строка или null)
- segment: "prepaid"/"postpaid"/null
- remarks: ограничения, особые условия; добавь "⚠ данные из базы знаний AI"

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
