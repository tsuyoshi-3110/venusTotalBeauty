// /app/sitemap.ts
import { type MetadataRoute } from "next";
import { pageUrl } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  // 必要な固定ページだけ列挙（必要に応じて追加/削除）
  const paths = [
    "/",
    "/about",
    "/news",
    "/areas/local",
    "/products",
    "/products-ec",
    "/projects",
    "/stores",
    "/faq",
  ];

  return paths.map((path) => ({
    url: pageUrl(path),
    lastModified: now,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1.0 : 0.6,
  }));
}
