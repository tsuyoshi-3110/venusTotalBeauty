// src/app/(routes)/news/page.tsx
import type { Metadata } from "next";
import NewsClient from "@/components/NewsClient";
import { seo } from "@/config/site"; // ← 固有情報は /config/site.ts に集約

// 例）/config/site.ts に pages.news を定義しておく：
// pages: { news: { path: "/news", title: `お知らせ｜${site.name}`, description: "...", ogType: "website" } }
export const metadata: Metadata = seo.page("news");

export default function NewsPage() {
  return (
    <main className="px-4 py-12 max-w-4xl mx-auto">
      <NewsClient />
    </main>
  );
}
