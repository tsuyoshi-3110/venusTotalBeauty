import type { Metadata } from "next";
import NewsClient from "@/components/NewsClient";

export const metadata: Metadata = {
  title: "お知らせ｜Venus Total Beauty（ネイルサロン）",
  description:
    "ネイルサロン Venus Total Beauty のお知らせページ。営業日、キャンペーン、季節メニューなどの最新情報を掲載しています。",
  openGraph: {
    title: "お知らせ｜Venus Total Beauty（ネイルサロン）",
    description:
      "ネイルサロン Venus Total Beauty のお知らせ。定休日やお得な情報を随時更新しています。",
    url: "https://venusTotalBeaty.shop/news",
    siteName: "Venus Total Beauty",
    images: [{ url: "/ogp-news.jpg", width: 1200, height: 630 }],
    locale: "ja_JP",
    type: "website",
  },
  alternates: { canonical: "https://venusTotalBeaty.shop/news" },
};

export default function NewsPage() {
  return (
    <main className="px-4 py-12 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mt-6 mb-6 text-center text-white/80">
        お知らせ
      </h1>
      <NewsClient />
    </main>
  );
}
