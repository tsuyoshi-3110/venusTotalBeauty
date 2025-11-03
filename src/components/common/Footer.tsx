// components/common/Footer.tsx
"use client";

import Image from "next/image";
import ScrollUpCTA from "@/components/ScrollUpCTA";
import { useUILang, type UILang } from "@/lib/atoms/uiLangAtom";
import { FOOTER_STRINGS, site } from "@/config/site";
import clsx from "clsx";
import { useThemeGradient } from "@/lib/useThemeGradient";
// 追加
import VCardDownloadButton from "@/components/common/VCardDownloadButton";

type T = {
  cta: string;
  snsAria: string;
  instagramAlt: string;
  lineAlt: string;
  siteAria: string;
  siteAlt: string;
  areaLinkText: string;
  rights: string;
};

// /config/site.ts からインポートした定義を使う
const STRINGS = FOOTER_STRINGS as Record<UILang, T>;

export default function Footer() {
  const { uiLang } = useUILang();
  const lang = (uiLang in STRINGS ? uiLang : "ja") as UILang;
  const t = STRINGS[lang];
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";
  const iconSize = 48;
  const gradient = useThemeGradient();

  return (
    <footer
      dir={dir}
      className="relative z-20 mt-10 border-t bg-white/30 text-sm text-white text-outline backdrop-blur supports-[backdrop-filter]:bg-white/40"
    >
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* CTA */}
          <ScrollUpCTA
            href="/contact"
            label={t.cta}
            className="w-full max-w-xs sm:max-w-sm"
          />

          {/* 連絡先ダウンロード（本店/単店/複数ピッカー/オーナーの自動分岐） */}
          <VCardDownloadButton
            className={clsx(
              "h-12 px-5 rounded-2xl shadow-2xl font-bold text-white text-outline",
              gradient
                ? ["bg-gradient-to-r", gradient, "hover:brightness-110"]
                : "bg-emerald-600 hover:bg-emerald-700"
            )}
            label="連絡先を保存"
          />

          {/* SNSアイコン */}
          <nav
            className="flex items-center justify-center gap-5"
            aria-label={t.snsAria}
          >
            <a
              href="https://lin.ee/KaFE6fA"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.lineAlt}
              className="transition-opacity hover:opacity-80"
            >
              <Image
                src="/line-logo.png"
                alt={t.lineAlt}
                width={iconSize}
                height={iconSize}
                className="object-contain"
              />
            </a>
            <a
              href="https://beauty.hotpepper.jp/kr/slnH000546712/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.siteAria}
              className="transition-opacity hover:opacity-80"
            >
              <Image
                src="/hotpepper-logo.png"
                alt={t.siteAlt || site.name}
                width={iconSize}
                height={iconSize}
                className="object-contain"
              />
            </a>
          </nav>

          {/* エリアリンク（SEO） */}
          <div className="space-y-1 text-xs leading-tight">
            <p>
              <a href="/areas/local" className="hover:underline">
                {t.areaLinkText}
              </a>
            </p>
          </div>

          {/* コピーライト */}
          <div className="space-y-1">
            <p className="font-semibold leading-tight">{site.name}</p>
            <p className="text-xs leading-tight">
              © {new Date().getFullYear()} Tayotteya. {t.rights}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
