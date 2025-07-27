import type { Metadata } from "next";
import ProductsClient from "@/components/ProductsClient";

export const metadata: Metadata = {
  title: "メニュー一覧｜Venus Total Beauty（ネイルサロン）",
  description:
    "Venus Total Beauty ネイルサロンのメニュー一覧ページ。定番メニューや季節のおすすめを写真付きで紹介しています。",
  openGraph: {
    title: "メニュー一覧｜Venus Total Beauty（ネイルサロン）",
    description:
      "ネイルサロン Venus Total Beauty の施術メニュー紹介ページ。写真付きで掲載し、編集や並び替えも可能です。",
    url: "https://venusTotalBeaty-homepage.vercel.app/products", // 実際のURLに置き換え可能
    siteName: "Venus Total Beauty",
    images: [
      {
        url: "/ogp-products.jpg", // 画像も必要なら実物に差し替え
        width: 1200,
        height: 630,
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
};

export default function ProductsPage() {
  return <ProductsClient />;
}
