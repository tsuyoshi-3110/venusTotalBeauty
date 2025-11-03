// src/lib/jsonld/video.ts
import type { DocumentData } from "firebase/firestore";

/** 相対→絶対URL */
const toAbs = (u: string | undefined, siteUrl: string, fallbackPath = "/ogpLogo.png") => {
  if (!u || typeof u !== "string") return `${siteUrl}${fallbackPath}`;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return `${siteUrl}${u.startsWith("/") ? u : `/${u}`}`;
};

/** 配列サムネにも対応して絶対URL化 */
const toAbsArray = (
  u: string | string[] | undefined,
  siteUrl: string,
  fallbackPath = "/ogpLogo.png"
) => {
  if (!u) return [toAbs(undefined, siteUrl, fallbackPath)];
  const arr = Array.isArray(u) ? u : [u];
  return arr.map((x) => toAbs(x, siteUrl, fallbackPath));
};

/** VideoObject を “ある時だけ” 生成（要件満たさなければ null） */
export function buildVideoJsonLd(settings: DocumentData | undefined, siteUrl: string) {
  const d = (settings ?? {}) as Record<string, any>;

  // 背景動画 or heroVideo があるときだけ
  const hasVideo =
    d?.type === "video" || !!d?.heroVideo?.contentUrl || !!d?.heroVideo?.embedUrl;
  if (!hasVideo) return null;

  // 入力候補
  const rawContentUrl: string | undefined =
    d?.heroVideo?.contentUrl ?? (d?.type === "video" ? d?.url : undefined);
  const rawEmbedUrl: string | undefined = d?.heroVideo?.embedUrl;

  // 絶対URL化（相対でもOKにする）
  const contentUrl = rawContentUrl ? toAbs(rawContentUrl, siteUrl) : undefined;
  const embedUrl = rawEmbedUrl ? toAbs(rawEmbedUrl, siteUrl) : undefined;

  const name: string =
    d?.heroVideo?.name ?? `${d?.siteName ?? "おそうじ処 たよって屋"} 紹介動画`;
  const description: string =
    d?.heroVideo?.description ?? d?.description ?? "サービス紹介動画です。";

  // サムネ（配列対応・背景動画からの推定もあり）
  const fallbackPoster =
    typeof d?.url === "string" ? d.url.replace(/\.mp4(\?.*)?$/, ".jpg") : undefined;
  const thumbnails = toAbsArray(
    d?.heroVideo?.thumbnailUrl ?? fallbackPoster ?? d?.headerLogoUrl,
    siteUrl,
    "/ogpLogo.png"
  );

  const uploadDate: string =
    d?.heroVideo?.uploadDate ??
    (d?.updatedAt?.toDate?.() ? d.updatedAt.toDate().toISOString() : new Date().toISOString());

  // 最低限（Google推奨の必須相当）
  const video: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name,
    description,
    thumbnailUrl: thumbnails,
    uploadDate,
    inLanguage: "ja-JP",
  };

  // どちらかは欲しい（ないなら null 返す）
  if (contentUrl) video.contentUrl = contentUrl;
  if (embedUrl) video.embedUrl = embedUrl;
  if (!contentUrl && !embedUrl) return null;

  // 任意（あれば付与）
  if (d?.heroVideo?.duration) video.duration = d.heroVideo.duration; // ISO8601: "PT30S" など

  const publisherName = d?.heroVideo?.publisherName ?? d?.siteName ?? "おそうじ処 たよって屋";
  const publisherLogoUrl = toAbs(d?.headerLogoUrl, siteUrl, "/ogpLogo.png");
  video.publisher = {
    "@type": "Organization",
    name: publisherName,
    logo: {
      "@type": "ImageObject",
      url: publisherLogoUrl,
    },
  };

  return video;
}
