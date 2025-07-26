import type { Metadata } from "next";
import StoresClient from "@/components/StoresClient";
import { PhoneSection } from "@/components/PhoneSection";

export const metadata: Metadata = {
  title: "店舗一覧｜Venus Total Beauty（ネイルサロン）",
  description:
    "Venus Total Beauty ネイルサロンの店舗一覧ページ。複数店舗型ビジネス向けの構成例です。",
  openGraph: {
    title: "店舗一覧｜Venus Total Beauty（ネイルサロン）",
    description:
      "ネイルサロン Venus Total Beauty の複数店舗表示ページ。所在地・営業時間・紹介文を掲載できます。",
    url: "https://venusTotalBeaty-homepage.vercel.app/stores", // 実際のURLに変更可
    siteName: "Venus Total Beauty",
    images: [
      {
        url: "/ogp-stores.jpg",
        width: 1200,
        height: 630,
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
};

export default function StoresPage() {
  return (
    <main className="px-4 py-16">
      {/* ページ見出し */}
      <section className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-2xl lg:text-3xl font-extrabold mb-4 text-white/80">
          Venus Total Beauty ─ 店舗一覧
        </h1>
        <p className="leading-relaxed text-white/80">
          <strong>Venus Total Beauty</strong> は
          <strong>東淀川区淡路</strong> を拠点に展開する
          ネイル＆ビューティーサロンです。
          お客様のライフスタイルに寄り添う、
          <br className="hidden lg:block" />
          丁寧で高品質なサービスをご提供しています。
        </p>
      </section>

      {/* 電話番号や連絡先セクション */}
      <section className="max-w-4xl mx-auto text-center mb-12">
        <PhoneSection />
      </section>

      {/* 店舗カード表示（Firestore対応） */}
      <StoresClient />
    </main>
  );
}
