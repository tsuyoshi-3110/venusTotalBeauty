import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Script from "next/script";
import ThemeBackground from "@/components/ThemeBackground";
import WallpaperBackground from "@/components/WallpaperBackground";
import SubscriptionOverlay from "@/components/SubscriptionOverlay";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Venus Total Beauty｜東淀川区淡路のネイルサロン",
  description:
    "大阪市東淀川区淡路にあるネイルサロン『Venus Total Beauty』。丁寧なケアと高品質な仕上がりが自慢です。",
  openGraph: {
    title: "Venus Total Beauty｜東淀川区淡路のネイルサロン",
    description:
      "丁寧なケアと高品質な仕上がりが自慢のネイルサロン。大阪市東淀川区淡路で営業中。",
    url: "https://venusTotalBeaty-homepage.vercel.app/",
    siteName: "Venus Total Beauty",
    images: [
      {
        url: "/ogp.jpg",
        width: 1200,
        height: 630,
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const siteKey = "venusTotalBeaty";

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <link
          rel="preload"
          as="image"
          href="/images/wallpaper/kamon.jpg"
          type="image/webp"
        />
        <meta name="theme-color" content="#ffffff" />
        <meta
          name="google-site-verification"
          content="UcH7-5B4bwpJxxSjIpBskahFhBRTSLRJUZ8A3LAnnFE"
        />
        <meta
          name="google-site-verification"
          content="h2O77asgMDfUmHBb7dda53OOJdsxv9GKXd5rrRgIQ-k"
        />
      </head>

      <body className="relative min-h-screen">
        <SubscriptionOverlay siteKey={siteKey} />
        <WallpaperBackground />
        <ThemeBackground />
        <Header />
        {children}

        <Script
          id="ld-json"
          type="application/ld+json"
          strategy="afterInteractive"
        >
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BeautySalon",
            name: "Venus Total Beauty",
            address: {
              "@type": "PostalAddress",
              addressLocality: "大阪市東淀川区淡路",
              streetAddress: "淡路4-18-13", // 実際の番地があれば修正してください
            },
            telephone: "06-1234-5678", // 実際の番号に変更してください
            url: "https://venusTotalBeaty-homepage.vercel.app/",
          })}
        </Script>
      </body>
    </html>
  );
}
