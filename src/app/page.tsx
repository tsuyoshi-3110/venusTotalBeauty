// app/page.tsx
import type { Metadata } from "next";
import { seo, site, copy } from "@/config/site";
import BackgroundVideo from "@/components/backgroundVideo/BackgroundVideo";
import TopFixedText from "@/components/TopFixedText";
import TopVisibleSections from "@/components/TopVisibleSections";

// ✅ 共通SEOビルダー（/config/site.ts で集中管理）
export const metadata: Metadata = seo.page("home");

export default function HomePage() {
  const headline = copy.home?.headline ?? site.name;
  const description = copy.home?.description ?? "";

  return (
    <main className="w-full overflow-x-hidden">
      {/* ① ファーストビュー */}
      <section className="relative h-screen overflow-hidden">
        <BackgroundVideo />
      </section>

      {/* ② テキスト紹介 */}
      <section className="relative z-10 text-white px-4 py-20">
        <TopFixedText />
        <h1 className="text-3xl lg:text-4xl font-extrabold text-center leading-tight mb-6 text-outline">
          {headline}
        </h1>
        {description && (
          <p className="max-w-3xl mx-auto text-center leading-relaxed text-outline">
            {description}
          </p>
        )}
        <TopVisibleSections />
      </section>
    </main>
  );
}
