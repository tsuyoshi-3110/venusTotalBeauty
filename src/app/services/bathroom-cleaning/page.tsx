// app/services/bathroom-cleaning/page.tsx
import type { Metadata } from "next";
import { buildBreadcrumbLd } from "@/lib/jsonld/breadcrumb";

export const metadata: Metadata = {
  title: "浴室クリーニング｜おそうじ処 たよって屋",
  description:
    "浴室のカビ・水垢・皮脂汚れを丁寧に除去。換気扇・鏡・排水口までプロの手で徹底清掃。大阪・兵庫の浴室クリーニングはたよって屋へ。",
  alternates: { canonical: "https://tayotteya.shop/services/bathroom-cleaning" },
  openGraph: {
    title: "浴室クリーニング｜おそうじ処 たよって屋",
    description:
      "カビ・水垢・皮脂汚れを徹底除去。プロの浴室クリーニングで清潔なお風呂に。",
    url: "https://tayotteya.shop/services/bathroom-cleaning",
    siteName: "おそうじ処 たよって屋",
    images: [{ url: "/ogpLogo.png", width: 1200, height: 630 }],
    locale: "ja_JP",
    type: "article",
  },
};

export default function BathroomCleaningPage() {
  const base = "https://tayotteya.shop";
  const breadcrumbLd = buildBreadcrumbLd([
    { name: "ホーム", url: `${base}/` },
    { name: "サービス", url: `${base}/services` },
    { name: "浴室クリーニング", url: `${base}/services/bathroom-cleaning` },
  ]);

  const safe = (o: object) => JSON.stringify(o).replace(/</g, "\\u003c");

  // ★Serviceの構造化データ（任意）
  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "浴室クリーニング",
    serviceType: "HouseCleaning",
    provider: {
      "@type": "LocalBusiness",
      name: "おそうじ処 たよって屋",
      url: base,
      telephone: "+81 90-6559-9110",
      address: {
        "@type": "PostalAddress",
        addressRegion: "大阪府",
        addressLocality: "豊中市",
        streetAddress: "小曽根3-6-13",
        postalCode: "561-0813",
        addressCountry: "JP",
      },
    },
    areaServed: [
      { "@type": "AdministrativeArea", name: "大阪府" },
      { "@type": "AdministrativeArea", name: "兵庫県" },
    ],
    offers: {
      "@type": "Offer",
      // 価格は公開可なら設定（未確定なら省略でOK）
      priceCurrency: "JPY",
      price: "ASK",
      availability: "https://schema.org/InStock",
      url: `${base}/contact`,
    },
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safe(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safe(serviceLd) }} />

      <h1 className="text-3xl font-extrabold mb-4">浴室クリーニング</h1>
      <p className="mb-6 leading-relaxed">
        カビ・水垢・皮脂汚れをプロの資器材で徹底除去。鏡のウロコ、床やドアのパッキンまで丁寧に仕上げます。
      </p>

      <h2 className="text-xl font-bold mt-8 mb-2">作業範囲</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>天井・壁・床・ドア周りの洗浄</li>
        <li>鏡のウロコ取り・蛇口・シャワーの水垢除去</li>
        <li>排水口・換気口の清掃</li>
      </ul>

      <h2 className="text-xl font-bold mt-8 mb-2">所要時間の目安</h2>
      <p>2〜3時間（汚れ具合により変動）</p>

      <div className="mt-8">
        <a href="/contact" className="inline-block rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">
          無料見積もり・お問い合わせ
        </a>
      </div>
    </main>
  );
}
