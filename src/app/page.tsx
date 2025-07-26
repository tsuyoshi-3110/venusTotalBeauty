// src/app/(routes)/home/page.tsx

import type { Metadata } from "next";
import BackgroundVideo from "@/components/BackgroundVideo";
import TopFixedText from "@/components/TopFixedText";

export const metadata: Metadata = {
  title: "Venus Total Beauty｜大阪市東淀川区淡路のネイルサロン",
  description:
    "Venus Total Beautyは大阪市東淀川区淡路にある上質なネイルサロン。丁寧な施術と落ち着いた空間で美しさを引き出します。",
  openGraph: {
    title: "Venus Total Beauty｜大阪市東淀川区淡路のネイルサロン",
    description:
      "Venus Total Beautyは、指先から美しさを引き出すネイルサロン。お客様一人ひとりに合わせたケアをご提供しています。",
    url: "https://venusTotalBeaty.shop/",
    siteName: "Venus Total Beauty",
    images: [
      {
        url: "/ogp-home.jpg",
        width: 1200,
        height: 630,
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
  alternates: { canonical: "https://venusTotalBeaty.shop/" },
};

export default function HomePage() {
  return (
    <main className="w-full overflow-x-hidden">
      {/* ① ファーストビュー：背景動画または画像 */}
      <section className="relative h-screen overflow-hidden">
        <BackgroundVideo />
      </section>

      {/* ② テキスト紹介セクション */}
      <section className="relative z-10 text-white px-4 py-20">
        {/* 編集可能な固定テキストコンポーネント */}
        <TopFixedText />

        <h1 className="text-3xl lg:text-4xl font-extrabold text-center leading-tight mb-6">
          Venus Total Beauty
          <br />
          ネイルで叶えるあなたらしさ
        </h1>

        <p className="max-w-3xl mx-auto text-center leading-relaxed">
          大阪市東淀川区淡路にあるネイルサロン
          <strong>「Venus Total Beauty」</strong>では、落ち着いた空間と丁寧な施術で、
          お客様一人ひとりの魅力を引き出します。
          初めての方も安心してご利用いただけるサロンです。
        </p>
      </section>

      {/* ③ JSON-LD（構造化データ）テンプレート */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "BeautySalon",
              name: "Venus Total Beauty",
              address: {
                "@type": "PostalAddress",
                addressLocality: "大阪市東淀川区淡路",
              },
              url: "https://venusTotalBeaty.shop/",
              telephone: "06-1234-5678",
              description: "ネイルサロン・ハンドケア・フットケア",
            },
          ]),
        }}
      />
    </main>
  );
}
