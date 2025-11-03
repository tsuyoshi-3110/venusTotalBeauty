// app/head.tsx
import { adminDb } from "@/lib/firebase-admin";
import { buildStoreJsonLd } from "@/lib/jsonld/store";
import { buildVideoJsonLd } from "@/lib/jsonld/video";
import { site, pageUrl } from "@/config/site";

export const runtime = "nodejs";
// 設定が頻繁に変わるなら動的配信を強制（不要ならコメントアウトでOK）
export const dynamic = "force-dynamic";

// URLはsite.tsの集中管理値を使用
const SITE_URL = pageUrl("/");

// Organization JSON-LD
const buildOrganizationJsonLd = (opts: {
  name: string;
  url: string;
  logo: string;
  sameAs?: string[];
}) => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: opts.name,
  url: opts.url,
  logo: opts.logo,
  sameAs: opts.sameAs ?? [],
});

// WebSite JSON-LD
const buildWebSiteJsonLd = (opts: { url: string; name: string }) => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  url: opts.url,
  name: opts.name,
  inLanguage: "ja-JP",
});

async function fetchSiteSettings() {
  try {
    const snap = await adminDb
      .collection("siteSettingsEditable")
      .doc(site.key) // ← atomsのSITE_KEYではなくsite.tsのkeyを使用
      .get();
    return (snap.data() as any) ?? {};
  } catch {
    return {};
  }
}

const safe = (o: object) => JSON.stringify(o).replace(/</g, "\\u003c");

export default async function Head() {
  const settings = await fetchSiteSettings();

  const orgLd = buildOrganizationJsonLd({
    name: settings.siteName ?? site.name,
    url: SITE_URL,
    logo: settings.logoUrl ?? settings.headerLogoUrl ?? pageUrl(site.logoPath),
    sameAs: [
      settings.instagram ?? site.socials.instagram,
      settings.line ?? site.socials.line,
    ].filter(Boolean),
  });

  const webSiteLd = buildWebSiteJsonLd({
    url: SITE_URL,
    name: settings.siteName ?? site.name,
  });

  // 業態に応じた LocalBusiness/Store のJSON-LDは既存ビルダーに委譲
  const localLd = buildStoreJsonLd(settings, SITE_URL);

  // 動画設定があれば VideoObject を出力
  const videoLd = buildVideoJsonLd(settings, SITE_URL);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safe(orgLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safe(webSiteLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safe(localLd) }}
      />
      {videoLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safe(videoLd) }}
        />
      )}
    </>
  );
}
