// src/lib/jsonld/store.ts
import type { DocumentData } from "firebase/firestore";

/* =========================
   Helpers
========================= */

/** 末尾スラッシュ除去 */
const trimSlash = (u: string) => u.replace(/\/$/, "");

/** 相対→絶対URL（先頭スラ無しも許容）。未指定時は fallbackPath を付与 */
const toAbs = (u: string | undefined, siteUrl: string, fallbackPath = "/ogpLogo.png") => {
  const root = trimSlash(siteUrl || "");
  if (!u || typeof u !== "string") return `${root}${fallbackPath}`;
  if (/^https?:\/\//i.test(u)) return u;
  return `${root}${u.startsWith("/") ? u : `/${u}`}`;
};

/** URL配列を絶対化＋重複除去 */
const toAbsList = (list: (string | undefined)[] | undefined, siteUrl: string) =>
  Array.from(
    new Set(
      (list ?? [])
        .filter(Boolean)
        .map((u) => toAbs(u as string, siteUrl))
    )
  );

/** JPのTELをざっくりE.164(+81)化（失敗時はそのまま） */
const toE164JP = (tel?: string) => {
  if (!tel) return undefined;
  const digits = tel.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+81${digits.slice(1)}`;
  return digits || undefined;
};

/** OpeningHoursSpecification 正規化（無ければ既定：月〜土 09:00-18:00） */
const normalizeOpeningHours = (raw: any): any[] => {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((r) => {
      if (!r || typeof r !== "object") return r;
      const days = Array.isArray(r.dayOfWeek) ? r.dayOfWeek : r.dayOfWeek ? [r.dayOfWeek] : undefined;
      return {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: days ?? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: r.opens ?? "09:00",
        closes: r.closes ?? "18:00",
      };
    });
  }
  // default
  return [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "09:00",
      closes: "18:00",
    },
  ];
};

/** 緯度経度を @type 付きで正規化（無ければ既定：豊中市付近） */
const normalizeGeo = (d: Record<string, any>) => {
  const g = d.geo ?? { latitude: d.latitude, longitude: d.longitude };
  const lat = typeof g?.latitude === "number" ? g.latitude : 34.7488;
  const lng = typeof g?.longitude === "number" ? g.longitude : 135.4821;
  return { "@type": "GeoCoordinates", latitude: lat, longitude: lng };
};

/** sameAs の正規化（空文字除去・重複除去） */
const normalizeSameAs = (d: Record<string, any>, siteUrl: string) => {
  const candidates = [
    d.sameAs, // 既に配列かもしれない
    d.instagram,
    d.line,
    d.twitter,
    d.x,
    d.facebook,
    d.youtube,
    d.tiktok,
    // NOTE: 便宜的にサイト自体も含めたい場合は下行を残す
    trimSlash(siteUrl),
  ]
    .flat()
    .filter(Boolean) as string[];

  // 簡易URLバリデーション
  const valid = candidates.filter((u) => typeof u === "string" && /^https?:\/\//i.test(u));
  return Array.from(new Set(valid));
};

/** エリア指定の正規化 */
const normalizeAreaServed = (raw: any): any[] => {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((x) =>
      typeof x === "string" ? { "@type": "AdministrativeArea", name: x } : x
    );
  }
  return [
    { "@type": "AdministrativeArea", name: "大阪府" },
    { "@type": "AdministrativeArea", name: "豊中市" },
    { "@type": "AdministrativeArea", name: "大阪市東淀川区" },
    { "@type": "AdministrativeArea", name: "兵庫県" },
  ];
};

/* =========================
   Main builder
========================= */

/**
 * LocalBusiness / CleaningService の JSON-LD を生成（欠損OK）
 * - store: Firestoreから取れた任意shape（undefinedでもOK）
 * - siteUrl: ルートURL（例: https://example.com）※末尾スラは自動除去
 */
export function buildStoreJsonLd(store: DocumentData | undefined, siteUrl: string) {
  const d = (store ?? {}) as Record<string, any>;
  const root = trimSlash(siteUrl);

  // 基本情報
  const siteName = d.siteName ?? d.title ?? d.shopName ?? "おそうじ処 たよって屋";
  const description =
    d.description ??
    "大阪府豊中市の家事代行・ハウスクリーニング専門店。水回り清掃から整理収納まで丁寧に対応します。";
  const url = toAbs(d.url, root, ""); // 相対でも絶対でもOK。未指定は root

  // 代表画像（オーナーが設定した imageUrls の先頭を最優先）
  const heroUrl = toAbs(
    d.imageUrls?.[0] ?? d.heroImageUrl ?? d.imageUrl1 ?? d.imageUrl,
    root,
    "/ogpLogo.png"
  );

  // ロゴ（未設定時は OGP でフォールバック）
  const logoUrl = toAbs(d.logoUrl ?? d.headerLogoUrl, root, "/ogpLogo.png");

  // image は配列で渡すと採用されやすい（重複除去）
  const images = toAbsList([heroUrl, logoUrl], root);

  // 電話番号
  const telephone = toE164JP(d.ownerTel ?? d.tel ?? d.phone) ?? "+81 90-6559-9110";

  // 住所
  const address = {
    "@type": "PostalAddress",
    streetAddress: d.address?.streetAddress ?? d.streetAddress ?? "小曽根3-6-13",
    addressLocality: d.address?.addressLocality ?? d.city ?? "豊中市",
    addressRegion: d.address?.addressRegion ?? d.pref ?? "大阪府",
    postalCode: d.address?.postalCode ?? d.postalCode ?? "561-0813",
    addressCountry: d.address?.addressCountry ?? "JP",
  };

  // 営業時間
  const openingHoursSpecification = normalizeOpeningHours(d.openingHoursSpecification);

  // 緯度経度
  const geo = normalizeGeo(d);

  // SNS等
  const sameAs = normalizeSameAs(d, root);

  // 提供エリア
  const areaServed = normalizeAreaServed(d.areaServed);

  // 任意: Google マップURLがあれば
  const hasMap = typeof d.hasMap === "string" ? d.hasMap : undefined;

  // 任意: 価格帯（例: "¥" | "¥¥" | "¥¥¥"）
  const priceRange = typeof d.priceRange === "string" ? d.priceRange : undefined;

  // 任意: 動画（オーナーが heroVideo を設定していれば VideoObject を付ける）
  const heroVideo = d.heroVideo && typeof d.heroVideo === "object"
    ? {
        "@type": "VideoObject",
        name: d.heroVideo.name ?? `${siteName} 紹介動画`,
        description: d.heroVideo.description ?? "サービス紹介動画です。",
        contentUrl: d.heroVideo.contentUrl, // Storage のダウンロードURLでOK
        thumbnailUrl: toAbs(
          d.heroVideo.thumbnailUrl ??
            (typeof d.url === "string" ? d.url.replace(/\.mp4(\?.*)?$/i, ".jpg") : undefined),
          root,
          "/ogpLogo.png"
        ),
        uploadDate: d.heroVideo.uploadDate ?? new Date().toISOString(),
        duration: d.heroVideo.duration, // 例: "PT30S"
      }
    : undefined;

  // エンティティの安定識別子
  const entityId = `${root}#localbusiness`;

  // 返却
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "CleaningService"],
    "@id": entityId,
    name: siteName,
    description,
    url,
    image: images,
    logo: logoUrl,
    telephone,
    address,
    openingHoursSpecification,
    geo,
    areaServed,
    sameAs,
    ...(hasMap ? { hasMap } : {}),
    ...(priceRange ? { priceRange } : {}),
    ...(heroVideo ? { video: heroVideo } : {}),
  };
}
