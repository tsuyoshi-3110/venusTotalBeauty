import type { Metadata } from "next";
import AboutClient from "@/components/AboutClient";

export const metadata: Metadata = {
  title: "当店の思い｜Venus Total Beauty（ネイルサロン）",
  description:
    "ネイルサロン Venus Total Beauty の想いをご紹介します。美しさと癒しをお届けする空間づくりにこだわっています。",
  openGraph: {
    title: "当店の思い｜Venus Total Beauty（ネイルサロン）",
    description:
      "美と癒しを大切に、指先から笑顔をお届けする Venus Total Beauty のこだわりをご紹介します。",
    url: "https://venusTotalBeaty-homepage.vercel.app/about",
    siteName: "Venus Total Beauty",
    images: [
      {
        url: "/ogp-about.jpg",
        width: 1200,
        height: 630,
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <main className="px-4 py-12 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mt-6 mb-6 text-center text-white/80">
        当店の思い
      </h1>
      <AboutClient />
    </main>
  );
}
