// /src/config/ai-site.ts
// 新規サイトごとに“ここだけ”書き換えればOK



/** 言語名（UIヒント用） */
export const LANG_NAME: Record<string, string> = {
  ja: "日本語",
  en: "English",
  zh: "简体中文",
  "zh-TW": "繁體中文",
  ko: "한국어",
  fr: "français",
  es: "español",
  de: "Deutsch",
  pt: "português",
  it: "italiano",
  ru: "русский",
  th: "ไทย",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
  hi: "हिन्दी",
  ar: "العربية",
};

/** 文言（最小限の多言語）。未定義言語は英語にフォールバックします。 */
export const L10N = {
  tone: {
    ja: "口調は丁寧・簡潔（です・ます）。",
    en: "Tone: polite and concise.",
  },
  productPriceAdvice: {
    ja: "商品価格については、商品一覧ページをご確認ください。", // リンクは貼らない
    en: "For product prices, please check the Products page.",       // no link
  },
  priceDisclaimer: {
    ja: "現地状況で変動する場合があります。",
    en: "Actual price may vary on site; please confirm with staff.",
  },
  scopeIntro: {
    ja: "サービス内容の説明、見積もり・予約方法、対応エリア、料金の目安、所要時間、注意事項、問い合わせ導線に回答します。",
    en: "Answer about services, estimates/booking flow, coverage areas, typical prices/duration, notes, and contact guidance.",
  },
  restrict: {
    ja: "危険な分解や薬剤使用の詳細手順は案内しません。確証が必要な事項は推測せず「担当者に確認します」と明記します。",
    en: "Do not provide dangerous disassembly/chemical handling steps. Do not speculate on final prices/schedules/availability; say you will confirm with staff.",
  },
  styleBullets: {
    ja: [
      "1〜3段落＋箇条書きを基本。",
      "専門用語は初出で短く補足（例：養生＝汚れ防止の保護）。",
      "曖昧語は最初に1問だけ意図確認してから具体回答。",
      "価格が参照知識にある場合は「目安：¥xx,xxx（税込）」形式で提示し、最後に価格注意書きを添える。",
    ],
    en: [
      "Prefer 1–3 short paragraphs plus bullet points.",
      "Briefly explain jargon when first used.",
      "If the user’s term is ambiguous, ask one quick clarifying question first.",
      "When knowledge includes prices, format as “Approx: ¥xx,xxx (tax incl.)” and append the price disclaimer.",
    ],
  },
};


/** 言語別の文字列取得（英語フォールバック） */
export function t<K extends keyof typeof L10N>(key: K, lang: string): (typeof L10N)[K][keyof (typeof L10N)[K]] {
  const pool = L10N[key] as any;
  return pool[lang] ?? pool["en"];
}
