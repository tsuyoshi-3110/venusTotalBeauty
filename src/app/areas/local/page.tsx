// app/areas/local/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { seo, pageUrl, copy, faqToJsonLd } from "@/config/site";

// すべての固有情報は /config/site.ts に集約
export const metadata: Metadata = seo.page("areasLocal");

export default function AreasLocalPage() {
  const C = copy.areasLocal;

  // FAQ 構造化データ（config から生成）
  const jsonLd = faqToJsonLd(C.faq);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{C.h1}</h1>
        <p className="text-sm text-muted-foreground">{C.lead}</p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        {C.services.map((s) => (
          <article key={s.title} className="rounded-xl border bg-white/70 p-5">
            <h2 className="font-semibold mb-2">{s.title}</h2>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {s.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="rounded-xl border bg-white/70 p-5">
        <h2 className="font-semibold mb-2">{C.coverageTitle}</h2>
        <p className="text-sm">{C.coverageBody}</p>
      </section>

      <section className="rounded-xl border bg-white/70 p-5">
        <h2 className="font-semibold mb-2">よくある質問</h2>

        {C.faq.slice(0, 2).map(({ q, a }) => (
          <details key={q} className="mb-2">
            <summary className="cursor-pointer font-medium">{q}</summary>
            <p className="text-sm mt-2">{a}</p>
          </details>
        ))}

        {/* 3問目以降を出したい場合は以下 */}
        {/* {C.faq.slice(2).map(({ q, a }) => (
          <details key={q}>
            <summary className="cursor-pointer font-medium">{q}</summary>
            <p className="text-sm mt-2">{a}</p>
          </details>
        ))} */}
      </section>

      <section className="rounded-xl border bg-white/70 p-5">
        <h2 className="font-semibold mb-2">{C.contactTitle}</h2>
        <p className="text-sm">{C.contactText}</p>
      </section>

      {/* 内部リンク（config の定義に追従） */}
      <nav className="text-sm underline">
        <Link href={pageUrl("/")}>{C.toProductsText}</Link>
      </nav>

      {/* FAQ 構造化データ（XSS回避で < を無害化） */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
    </main>
  );
}
