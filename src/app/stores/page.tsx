// /app/stores/page.tsx
import StoresClient from "@/components/StoresClient";
import { PhoneSection } from "@/components/PhoneSection";
import { seo, copy } from "@/config/site"; // ← site は不要（コピーを集中管理）

export const metadata = seo.page("stores");

export default function StoresPage() {
  const t = copy.stores;

  return (
    <main className="px-4 py-16">
      {/* Hero（完成文を site.ts で集中管理） */}
      <section className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-2xl lg:text-3xl font-extrabold mb-4 text-white text-outline">
          {t.heroTitle}
        </h1>
        <p className="leading-relaxed text-white text-outline">
          {t.heroIntroLine}
          <br className="hidden lg:block" />
          {t.heroTail}
        </p>
      </section>

      <section className="max-w-4xl mx-auto text-center mb-12">
        <PhoneSection />
      </section>

      <StoresClient />
    </main>
  );
}
