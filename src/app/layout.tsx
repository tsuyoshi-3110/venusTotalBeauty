// app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/common/Header";
import Footer from "@/components/common/Footer";
import ThemeBackground from "@/components/ThemeBackground";
import WallpaperBackground from "@/components/WallpaperBackground";
import SubscriptionOverlay from "@/components/SubscriptionOverlay";
import AnalyticsLogger from "@/components/AnalyticsLogger";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { CartProvider } from "@/lib/cart/CartContext";
import { seo, site, pageUrl, PUBLIC_ADDRESS } from "@/config/site";
import {
  kosugiMaru, notoSansJP, shipporiMincho, reggaeOne, yomogi, hachiMaruPop,
} from "@/lib/font";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = seo.base();

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

function toLD(obj: unknown) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const BASE = site.baseUrl.replace(/\/$/, "");
  const sameAs = Object.values(site.socials).filter(Boolean);
  const mainImage = pageUrl(site.logoPath);

  const ldGraph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${BASE}#org`,
        name: site.name,
        url: site.baseUrl,
        logo: mainImage,
        image: [mainImage],
        ...(site.tel ? { telephone: site.tel } : {}),
        ...(sameAs.length ? { sameAs } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${BASE}#website`,
        name: site.name,
        url: site.baseUrl,
        publisher: { "@id": `${BASE}#org` },
      },
      {
        "@type": "LocalBusiness",
        "@id": `${BASE}#local`,
        name: site.name,
        url: site.baseUrl,
        image: [mainImage],
        ...(site.tel ? { telephone: site.tel } : {}),
        address: PUBLIC_ADDRESS.postal,
        hasMap: PUBLIC_ADDRESS.hasMap,
        /** ★ここを追加 → 任意の価格帯（￥〜￥￥￥） */
        priceRange: "￥￥",
      },
    ],
  };

  return (
    <html
      lang="ja"
      className={[
        geistSans.variable, geistMono.variable,
        kosugiMaru.variable, notoSansJP.variable,
        yomogi.variable, hachiMaruPop.variable,
        reggaeOne.variable, shipporiMincho.variable,
        "antialiased",
      ].join(" ")}
    >
      <head>
        <link rel="preload" as="image" href={site.logoPath} type="image/png" />
        <Script
          id="ld-graph"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: toLD(ldGraph) }}
        />
      </head>

      <body className="relative min-h-[100dvh] flex flex-col">
        <WallpaperBackground />
        <ThemeBackground />
        <AnalyticsLogger />
        <CartProvider>
          <SubscriptionOverlay siteKey={SITE_KEY} />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
