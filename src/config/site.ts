/*
 * Refactored /config/site.ts （Venus Total Beauty 版）
 * 目的：新規 Pageit 作成時に「最小の上書き」だけで全体が組み上がるようにする。
 * 使い方：
 *   1) SITE_BRAND / SITE_OVERRIDES の値だけを書き換える（店舗名・キャッチ・説明など）
 *   2) 必要なら copy, PAGES の文言や画像パスを調整
 *   3) それ以外は触らずに使い回し可能
 */

import type { Metadata } from "next";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { type AiSiteConfig } from "@/types/AiSite";
import { type FooterI18n } from "@/types/FooterI18n";
import { type FaqItem } from "@/types/FaqItem";
import { type PageDef } from "@/types/PageDef";

/* =========================
   URL / 環境ユーティリティ
========================= */
const ENV_BASE_URL_RAW =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const BASE_URL = ENV_BASE_URL_RAW.replace(/\/$/, "");

function safeHost(input: string, fallback = "localhost:3000"): string {
  try {
    return new URL(input).host;
  } catch {
    return fallback;
  }
}

function safeMetadataBase(input: string): URL | undefined {
  try {
    return new URL(input);
  } catch {
    return undefined;
  }
}

const DOMAIN = safeHost(BASE_URL);
const METADATA_BASE_SAFE = safeMetadataBase(BASE_URL);

/* =========================
   サイト定義ファクトリ（単一情報源）
========================= */
export type SiteOverrides = {
  /** 店舗名（ブランド名） */
  name: string;
  /** キャッチコピー */
  tagline: string;
  /** サイト説明（OG/SEO 共通） */
  description: string;
  /** 検索キーワード */
  keywords: ReadonlyArray<string>;
  /** 代表TEL（任意） */
  tel?: string;
  /** ロゴ/OG既定パス */
  logoPath?: string;
  /** Google Site Verification（任意） */
  googleSiteVerification?: string;
  /** SNS（任意） */
  socials?: Partial<{
    instagram: string;
    line: string;
    x: string;
    facebook: string;
  }>;
  /** baseUrl を個別指定したい場合のみ */
  baseUrl?: string;
};

function createSite(overrides: SiteOverrides) {
  const baseUrl = (overrides.baseUrl ?? BASE_URL).replace(/\/$/, "");
  const domain = safeHost(baseUrl, DOMAIN);
  return {
    key: SITE_KEY,
    domain,
    baseUrl,
    name: overrides.name,
    tagline: overrides.tagline,
    description: overrides.description,
    keywords: overrides.keywords as readonly string[],
    tel: overrides.tel ?? "",
    logoPath: overrides.logoPath ?? "/logo.png",
    googleSiteVerification: "c_QRPmJ75M0nJzwfqxd6Ziv5VB-BXk5-2OsDNAwtkZk",
    socials: {
      instagram: overrides.socials?.instagram ?? "",
      line: overrides.socials?.line ?? "",
      x: overrides.socials?.x ?? "",
      facebook: overrides.socials?.facebook ?? "",
    },
  } as const;
}

/* =========================
   ★ 店舗ごとの最小上書き（ここだけ編集）
========================= */
const SITE_BRAND = "Venus Total Beauty"; // 表示用のフル表記

const SITE_OVERRIDES: SiteOverrides = {
  name: "Venus Total Beauty",
  tagline: "東淀川区淡路のネイルサロン",
  description:
    "大阪市東淀川区淡路にあるネイルサロン『Venus Total Beauty』。丁寧なケアと高品質な仕上がりが自慢です。",
  keywords: [
    "Venus Total Beauty",
    "ビーナス トータルビューティー",
    "ネイルサロン",
    "大阪市東淀川区",
    "淡路",
    "ジェルネイル",
    "フットネイル",
    "ネイルケア",
    "ワンカラー",
    "フレンチ",
    "グラデーション",
  ],
  tel: "",
  logoPath: "/logo.png",
  googleSiteVerification: "",
  socials: {
    instagram: "",
    line: "",
    x: "",
    facebook: "",
  },
  // ユーザー指定に合わせた公開URL（末尾スラッシュは自動で削除）
  baseUrl: "https://venusTotalBeaty-homepage.vercel.app/",
};

/* =========================
   サイト定義（以降は原則編集不要）
========================= */
export const siteName = SITE_BRAND; // 互換：従来の siteName を残す
export const site = createSite(SITE_OVERRIDES);

/* =========================
   住所（公開用）
   ※ 具体住所が未定のため、エリア表記のみ。
========================= */
export type PublicAddress = {
  text: string; // 表示用
  postal: {
    "@type": "PostalAddress";
    addressCountry: "JP";
    addressRegion: string;
    addressLocality: string;
    streetAddress: string;
    postalCode?: string;
  };
  hasMap: string; // Google Maps 検索URL
};
function mapUrlFromText(text: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    text
  )}`;
}

/** サロンの公開住所（必要に応じてこの値だけ編集） */
export const PUBLIC_ADDRESS: PublicAddress = {
  text: "大阪市東淀川区淡路",
  postal: {
    "@type": "PostalAddress",
    addressCountry: "JP",
    addressRegion: "大阪府",
    addressLocality: "大阪市東淀川区",
    streetAddress: "淡路",
  },
  hasMap: mapUrlFromText("大阪市東淀川区淡路"),
};

/* =========================
   便利ヘルパ
========================= */
export const pageUrl = (path = "/") =>
  `${site.baseUrl.replace(/\/$/, "")}${
    path.startsWith("/") ? path : `/${path}`
  }`;

const ogImage = (p?: string) => pageUrl(p ?? site.logoPath);

/* =========================
   コピー（集中管理）
========================= */
export const copy = {
  // Home（/）用
  home: {
    headline: site.name,
    description:
      "丁寧なケアと高品質な仕上がりが自慢のプライベートネイルサロン。ご希望のデザイン・肌なじみ・持ちの良さまで、ライフスタイルに合わせてご提案します。",
  },

  // Stores（/stores）用：単一店舗だが既存構成に合わせて文言調整
  stores: {
    heroTitle: `${site.name} ─ サロン情報`,
    heroAreas: "大阪市東淀川区・淡路",
    heroLead: "落ち着いた空間で丁寧に施術いたします。",
    heroTail: "アクセス・営業情報・お問い合わせは各ページをご覧ください。",
    heroIntroLine: `${site.name}は大阪市東淀川区・淡路エリアにあるネイルサロンです。`,
  },

  /** ローカルエリアページ（/areas/local） */
  areasLocal: {
    // ページ見出し
    h1: "淡路のネイルサロン（東淀川区）",
    lead: "大阪市東淀川区・淡路エリアで、丁寧なケアと仕上がりを大切にしたネイルをご提供。",

    // サービスブロック
    services: [
      {
        title: "ハンドジェル",
        bullets: [
          "ワンカラー／グラデーション／フレンチ",
          "定番～トレンドデザイン",
          "オフ・ケア込みメニューあり",
        ],
      },
      {
        title: "フットジェル・ケア",
        bullets: [
          "フットワンカラー／アート",
          "爪まわりのケア",
          "季節デザインのご提案",
        ],
      },
      {
        title: "オフ・ケア・リペア",
        bullets: [
          "自店オフ／他店オフ",
          "甘皮ケア",
          "フィルイン・補強（メニューにより）",
        ],
      },
    ],

    // カバレッジ
    coverageTitle: "対応エリア（目安）",
    coverageBody:
      "淡路・東淡路・菅原・豊新・上新庄・瑞光・小松・北江口・井高野・豊里・大道南 ほか（東淀川区周辺）",

    // FAQ（→ 構造化データに流用）
    faq: [
      {
        q: "オフのみの予約は可能ですか？",
        a: "可能です。自店・他店いずれも対応します（料金はメニューに準じます）。",
      },
      {
        q: "長さ出しや補強はできますか？",
        a: "一部メニューで対応可能です。ご予約時にご相談ください。",
      },
      {
        q: "支払い方法は何がありますか？",
        a: "現金のほかキャッシュレスも順次対応予定です。詳細は当日ご案内します。",
      },
      {
        q: "予約の変更やキャンセルは可能ですか？",
        a: "前日までのご連絡をお願いします。当日の変更はお電話またはLINEでご相談ください。",
      },
    ],

    // お問い合わせブロック
    contactTitle: "ご予約・お問い合わせ",
    contactText:
      "空き状況の確認・メニュー相談は、LINE／フォームからお気軽にどうぞ。",

    // 下部ナビ
    toProductsText: "メニューを見る",
  },
} as const;

/* =========================
   Footer L10N（サイト名は自動追従）
========================= */
function footerAlt(name: string) {
  return name || "Official Website";
}

/** Footer の多言語テキスト */
export const FOOTER_STRINGS: Record<string, FooterI18n> = {
  ja: {
    cta: "ご予約・お問い合わせ",
    snsAria: "SNSリンク",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "公式サイト",
    siteAlt: site.name,
    areaLinkText: "淡路のネイルサロン（東淀川区）",
    rights: "All rights reserved.",
  },
  en: {
    cta: "Book / Contact",
    snsAria: "Social links",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Official website",
    siteAlt: footerAlt(site.name),
    areaLinkText: "Nail salon in Awaji, Higashiyodogawa",
    rights: "All rights reserved.",
  },
  zh: {
    cta: "预约・咨询",
    snsAria: "社交链接",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "官网",
    siteAlt: `Venus Total Beauty 官方网站`,
    areaLinkText: "东淀川区・淡路的美甲沙龙",
    rights: "版权所有。",
  },
  "zh-TW": {
    cta: "預約・洽詢",
    snsAria: "社群連結",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "官方網站",
    siteAlt: `Venus Total Beauty 官方網站`,
    areaLinkText: "東淀川區・淡路的美甲沙龍",
    rights: "版權所有。",
  },
  ko: {
    cta: "예약 / 문의",
    snsAria: "SNS 링크",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "공식 사이트",
    siteAlt: `Venus Total Beauty 공식`,
    areaLinkText: "히가시요도가와구 아와지의 네일 살롱",
    rights: "판권 소유.",
  },
  fr: {
    cta: "Réserver / Contact",
    snsAria: "Liens sociaux",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Site officiel",
    siteAlt: `Venus Total Beauty (Officiel)`,
    areaLinkText: "Salon de manucure à Awaji (Higashiyodogawa)",
    rights: "Tous droits réservés.",
  },
  es: {
    cta: "Reservas / Contacto",
    snsAria: "Enlaces sociales",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Sitio oficial",
    siteAlt: `Venus Total Beauty (Oficial)`,
    areaLinkText: "Salón de uñas en Awaji, Higashiyodogawa",
    rights: "Todos los derechos reservados.",
  },
  de: {
    cta: "Buchen / Kontakt",
    snsAria: "Soziale Links",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Offizielle Website",
    siteAlt: `Venus Total Beauty (Offiziell)`,
    areaLinkText: "Nagelstudio in Awaji (Higashiyodogawa)",
    rights: "Alle Rechte vorbehalten.",
  },
  pt: {
    cta: "Reserva / Contato",
    snsAria: "Redes sociais",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Site oficial",
    siteAlt: `Venus Total Beauty (Oficial)`,
    areaLinkText: "Salão de unhas em Awaji, Higashiyodogawa",
    rights: "Todos os direitos reservados.",
  },
  it: {
    cta: "Prenota / Contatti",
    snsAria: "Link social",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Sito ufficiale",
    siteAlt: `Venus Total Beauty (Ufficiale)`,
    areaLinkText: "Nail salon a Awaji (Higashiyodogawa)",
    rights: "Tutti i diritti riservati.",
  },
  ru: {
    cta: "Запись / Контакты",
    snsAria: "Ссылки на соцсети",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Официальный сайт",
    siteAlt: `Venus Total Beauty (Официальный)`,
    areaLinkText: "Ногтевой салон в районе Авадзи (Хигасийодогава)",
    rights: "Все права защищены.",
  },
  th: {
    cta: "จองคิว / ติดต่อ",
    snsAria: "ลิงก์โซเชียล",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "เว็บไซต์ทางการ",
    siteAlt: `Venus Total Beauty (ทางการ)`,
    areaLinkText: "ร้านทำเล็บที่อาวาจิ เขตฮิกาชิโยโดกาวะ",
    rights: "สงวนลิขสิทธิ์",
  },
  vi: {
    cta: "Đặt lịch / Liên hệ",
    snsAria: "Liên kết mạng xã hội",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Trang chính thức",
    siteAlt: `Venus Total Beauty (Chính thức)`,
    areaLinkText: "Tiệm nails tại Awaji (Higashiyodogawa)",
    rights: "Mọi quyền được bảo lưu.",
  },
  id: {
    cta: "Booking / Kontak",
    snsAria: "Tautan sosial",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Situs resmi",
    siteAlt: `Venus Total Beauty (Resmi)`,
    areaLinkText: "Salon kuku di Awaji, Higashiyodogawa",
    rights: "Hak cipta dilindungi.",
  },
  hi: {
    cta: "बुकिंग / संपर्क",
    snsAria: "सोशल लिंक",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "आधिकारिक वेबसाइट",
    siteAlt: `Venus Total Beauty (आधिकारिक)`,
    areaLinkText: "अवाजी, हिगाशी-योदोगावा का नेल सैलून",
    rights: "सर्वाधिकार सुरक्षित।",
  },
  ar: {
    cta: "حجز / تواصل",
    snsAria: "روابط التواصل الاجتماعي",
    instagramAlt: "إنستغرام",
    lineAlt: "لاين",
    siteAria: "الموقع الرسمي",
    siteAlt: `Venus Total Beauty (رسمي)` as unknown as string,
    areaLinkText: "صالون أظافر في أواجي (هيغاشي يودوغاوا)",
    rights: "جميع الحقوق محفوظة.",
  },
};

/* =========================
   FAQ データ（ここで集約管理）
========================= */
export const faqItems: FaqItem[] = [
  {
    question: "メニューの所要時間はどのくらいですか？",
    answer:
      "デザインにより前後しますが、ハンドジェルのワンカラーで約60〜90分が目安です。初回の方はカウンセリング分を少し長めにいただきます。",
  },
  {
    question: "オフ代はかかりますか？",
    answer:
      "自店オフ・他店オフいずれもメニューにより異なります。ご予約ページの料金表をご確認ください。",
  },
  {
    question: "支払い方法は？",
    answer: "現金のほか、キャッシュレス決済にも順次対応予定です。",
  },
  {
    question: "予約の変更・キャンセルは可能ですか？",
    answer:
      "前日までの変更・キャンセルは無料です。当日の場合はLINEまたはお電話でご相談ください。",
  },
  {
    question: "長さ出しや補強はできますか？",
    answer:
      "一部メニューで対応可能です。爪の状態によりご提案が変わりますので、事前にご相談ください。",
  },
];

/* =========================
   ページ辞書（ogImage は任意）
========================= */
const PAGES = {
  home: {
    path: "/",
    title: `${site.name}｜${site.tagline}`,
    description:
      "丁寧なケアと高品質な仕上がりが自慢のネイルサロン。大阪市東淀川区・淡路で営業中。",
    ogType: "website",
  },
  about: {
    path: "/about",
    title: `サロンについて｜${site.name}`,
    description:
      "カウンセリングからケア、仕上げまで一つひとつ丁寧に。プライベート空間でリラックスしてお過ごしください。",
    ogType: "website",
  },
  news: {
    path: "/news",
    title: `お知らせ｜${site.name}`,
    description: `${site.name} の最新情報・キャンペーン・営業スケジュールなど。`,
    ogType: "website",
  },
  areasLocal: {
    path: "/areas/local",
    title: `淡路のネイルサロン（東淀川区）｜${site.name}`,
    description:
      "東淀川区・淡路エリアで、ハンド／フットのジェルネイル・ケア・オフに対応。",
    ogType: "article",
  },
  products: {
    path: "/products",
    title: `メニュー・料金｜${site.name}`,
    description: `${site.name}のメニュー・料金一覧。ハンド／フット、ワンカラー、グラデ、フレンチ、オフ・ケアなど。`,
    ogType: "website",
    ogImage: "/logo.png",
  },
  productsEC: {
    path: "/products-ec",
    title: `オンライン予約｜${site.name}`,
    description: `${site.name}のオンライン予約ページ。空き状況のご確認・ご予約はこちらから。`,
    ogType: "website",
    ogImage: "/logo.png",
  },
  projects: {
    path: "/projects",
    title: `デザイン例・ギャラリー｜${site.name}`,
    description: `季節のデザインや人気アートのギャラリー。仕上がりの雰囲気をご覧ください。`,
    ogType: "website",
  },
  stores: {
    path: "/stores",
    title: `アクセス｜${site.name}`,
    description: `${site.name}へのアクセス・周辺情報のご案内。`,
    ogType: "website",
  },
  faq: {
    path: "/faq",
    title: `よくある質問（FAQ）｜${site.name}`,
    description: `料金・オフ・支払い方法・予約変更など、${site.name}に関するご質問にお答えします。`,
    ogType: "article",
  },
} as const;

export type PageKey = keyof typeof PAGES;
const pages: Record<PageKey, PageDef> = PAGES as unknown as Record<
  PageKey,
  PageDef
>;

/* =========================
   SEO メタデータビルダー
   （指定の metadata 相当を自動生成）
========================= */
export const seo = {
  base: (): Metadata => ({
    title: `${site.name}｜${site.tagline}`,
    description: site.description,
    keywords: Array.from(site.keywords),
    authors: [{ name: site.name }],
    metadataBase: METADATA_BASE_SAFE,
    alternates: { canonical: pageUrl("/") },

    verification: site.googleSiteVerification
      ? { google: site.googleSiteVerification }
      : undefined,

    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },

    openGraph: {
      title: `${site.name}｜${site.tagline}`,
      description:
        "丁寧なケアと高品質な仕上がりが自慢のネイルサロン。大阪市東淀川区淡路で営業中。",
      url: pageUrl("/"),
      siteName: site.name,
      type: "website",
      images: [
        {
          url: pageUrl(site.logoPath),
          width: 1200,
          height: 630,
          alt: `${site.name} OGP`,
        },
      ],
      locale: "ja_JP",
    },
    twitter: {
      card: "summary_large_image",
      title: `${site.name}｜${site.tagline}`,
      description: site.description,
      images: [pageUrl(site.logoPath)],
    },
    icons: {
      icon: [
        { url: "/favicon.ico?v=4" },
        { url: "/icon.png", type: "image/png", sizes: "any" },
      ],
      apple: "/icon.png",
      shortcut: "/favicon.ico?v=4",
    },
  }),

  page: (key: PageKey, extra?: Partial<Metadata>): Metadata => {
    const p = pages[key];
    return {
      title: p.title,
      description: p.description,
      keywords: Array.from(site.keywords),
      alternates: { canonical: pageUrl(p.path) },
      openGraph: {
        title: p.title,
        description: p.description,
        url: pageUrl(p.path),
        siteName: site.name,
        images: [
          {
            url: ogImage((p as any).ogImage),
            width: 1200,
            height: 630,
            alt: site.name,
          },
        ],
        locale: "ja_JP",
        type: p.ogType,
      },
      twitter: {
        card: "summary_large_image",
        title: p.title,
        description: p.description,
        images: [ogImage((p as any).ogImage)],
      },
      ...extra,
    };
  },
};

/* =========================
   FAQ → JSON-LD 変換
========================= */
export type QA = { q: string; a: string };
export function faqToJsonLd(faq: ReadonlyArray<QA>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/* =========================
   AI サイト設定（ブランド名/URLは site に追従）
========================= */
export const AI_SITE: AiSiteConfig = {
  brand: site.name,
  url: site.baseUrl,
  areasByLang: {
    ja: "大阪市東淀川区・淡路",
    en: "Awaji, Higashiyodogawa, Osaka",
  },
  servicesByLang: {
    ja: ["ハンドジェル", "フットジェル", "オフ・ケア", "アート・リペア"],
    en: ["hand gel", "foot gel", "off & care", "art & repair"],
  },
  retail: false, // 物販ではなくサービス主体
  productPageRoute: "/products",
  languages: {
    default: "ja",
    allowed: [
      "ja",
      "en",
      "zh",
      "zh-TW",
      "ko",
      "fr",
      "es",
      "de",
      "pt",
      "it",
      "ru",
      "th",
      "vi",
      "id",
      "hi",
      "ar",
    ],
  },
  limits: {
    qaBase: 30,
    qaOwner: 40,
    qaLearned: 60,
    menuLines: 120,
    productLines: 120,
    keywords: 200,
  },
};
