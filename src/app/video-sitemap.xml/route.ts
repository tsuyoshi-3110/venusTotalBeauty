// app/video-sitemap.xml/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { site, pageUrl } from "@/config/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// 絶対URL化（相対も許容）
const toAbs = (u?: string, base = site.baseUrl): string | undefined => {
  if (!u) return undefined;
  if (/^https?:\/\//i.test(u)) return u;
  const b = base.replace(/\/$/, "");
  return `${b}${u.startsWith("/") ? u : `/${u}`}`;
};

// XMLエスケープ
const esc = (s = "") =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));

// ISO8601 → 秒（失敗時は undefined）
const isoToSec = (iso?: string) => {
  if (!iso) return undefined;
  try {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return undefined;
    const h = parseInt(m[1] || "0", 10);
    const mm = parseInt(m[2] || "0", 10);
    const s = parseInt(m[3] || "0", 10);
    return h * 3600 + mm * 60 + s;
  } catch {
    return undefined;
  }
};

export async function GET() {
  // Firestore 設定取得
  let s: any = {};
  try {
    const snap = await adminDb.collection("siteSettingsEditable").doc(SITE_KEY).get();
    s = snap.exists ? (snap.data() as any) : {};
  } catch {
    s = {};
  }

  const hv = (s.heroVideo ?? {}) as any;

  // 動画URL候補（相対→絶対）
  const contentUrl =
    toAbs(hv.contentUrl) ?? (s.type === "video" ? toAbs(s.url) : undefined);

  const embedUrl = toAbs(hv.embedUrl);

  // サムネ：優先順位 thumbnailUrl > 背景動画の派生jpg > headerLogo > OGP
  const thumbnailUrl: string | undefined =
    toAbs(hv.thumbnailUrl) ??
    (typeof s.url === "string" && /^https?:\/\//i.test(s.url)
      ? s.url.replace(/\.mp4(\?.*)?$/i, ".jpg")
      : undefined) ??
    toAbs(s.headerLogoUrl) ??
    pageUrl("/ogpLogo.png");

  // 必須：サムネ + （本編 or 埋め込み）
  if (!thumbnailUrl || (!contentUrl && !embedUrl)) {
    const empty = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"></urlset>`;
    return new NextResponse(empty, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store, max-age=0, s-maxage=0",
      },
    });
  }

  // duration: 秒数（durationSec 優先、無ければ ISO8601 の duration を秒化）
  const duration =
    typeof hv.durationSec === "number" ? Math.round(hv.durationSec) : isoToSec(hv.duration);

  // 公開日
  const pubDate =
    (typeof hv.uploadDate === "string" && hv.uploadDate) ||
    (s?.updatedAt?.toDate?.() ? s.updatedAt.toDate().toISOString() : new Date().toISOString());

  // 視聴ページ（実際に動画を見られるURLが推奨）
  const landingPath = hv.landingPath || "/video";
  const loc = pageUrl(landingPath);

  // 任意情報
  const tags: string[] = Array.isArray(hv.tags) ? hv.tags.slice(0, 32) : [];
  const category: string | undefined = hv.category;

  const videoParts = [
    "<video:video>",
    `<video:thumbnail_loc>${esc(thumbnailUrl)}</video:thumbnail_loc>`,
    `<video:title>${esc(hv.name || "紹介動画")}</video:title>`,
    `<video:description>${esc(hv.description || "サービス紹介動画")}</video:description>`,
    contentUrl ? `<video:content_loc>${esc(contentUrl)}</video:content_loc>` : "",
    embedUrl ? `<video:player_loc allow_embed="yes">${esc(embedUrl)}</video:player_loc>` : "",
    duration ? `<video:duration>${duration}</video:duration>` : "",
    `<video:publication_date>${esc(pubDate)}</video:publication_date>`,
    ...tags.map((t) => `<video:tag>${esc(t)}</video:tag>`),
    category ? `<video:category>${esc(category)}</video:category>` : "",
    "</video:video>",
  ].filter(Boolean).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url>
    <loc>${esc(loc)}</loc>
    ${videoParts}
  </url>
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0, s-maxage=0",
    },
  });
}
