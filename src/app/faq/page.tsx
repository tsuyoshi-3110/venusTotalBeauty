// /app/faq/page.tsx
import { seo, faqItems } from "@/config/site";
import { buildFAQJsonLd } from "@/lib/jsonld/faq";

export const metadata = seo.page("faq");

const safe = (o: object) => JSON.stringify(o).replace(/</g, "\\u003c");

export default function FAQPage() {
  const jsonLd = buildFAQJsonLd(faqItems);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {/* FAQ 構造化データ（ページ単位で埋め込み） */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safe(jsonLd) }}
      />

      <h1 className="text-3xl font-extrabold mb-6">よくある質問（FAQ）</h1>

      <dl className="space-y-6">
        {faqItems.map((f, i) => (
          <div key={i} className="bg-white/40 rounded-2xl p-4 shadow">
            <dt className="font-bold mb-2">Q. {f.question}</dt>
            <dd className="leading-relaxed">A. {f.answer}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
