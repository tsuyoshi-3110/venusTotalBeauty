// /app/robots.ts
import { type MetadataRoute } from "next";
import { site } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  // site.baseUrl は NEXT_PUBLIC_APP_URL を元に生成（末尾スラッシュ除去）
  const base = site.baseUrl.replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: [`${base}/sitemap.xml`, `${base}/video-sitemap.xml`],
    host: base,
  };
}
