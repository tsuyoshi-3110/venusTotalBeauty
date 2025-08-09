"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Image from "next/image";
import clsx from "clsx";

import { useThemeGradient } from "@/lib/useThemeGradient";
import { useHeaderLogoUrl } from "../hooks/useHeaderLogoUrl";


type HeaderProps = {
  className?: string;
};



const SNS: {
  name: string;
  href: string;
  icon: React.FC;
}[] = [

  {
    name: "LINE",
    href: "https://lin.ee/KaFE6fA",
    icon: () => (
      <Image
        src="/line-logo.png"
        alt="LINE"
        width={32}
        height={32}
        className="object-contain"
      />
    ),
  },
  {
    name: "HotPepper",
    href: "https://beauty.hotpepper.jp/kr/slnH000546712/",
    icon: () => (
      <Image
        src="/hotpepper-logo.png"
        alt="HotPepper"
        width={32}
        height={32}
        className="object-contain"
      />
    ),
  },
];


export default function Header({ className = "" }: HeaderProps) {
  /* ▼ 追加：Sheet の開閉を管理するステート */
  const [open, setOpen] = useState(false);
  const gradient = useThemeGradient();
  const logoUrl = useHeaderLogoUrl();

  const gradientClass = gradient
    ? `bg-gradient-to-b ${gradient}`
    : "bg-gray-100";

  return (
    <header
      className={clsx(
        "fixed top-0 z-30 w-full",
        "flex items-center justify-between px-4 h-12 text-whit ",
        `bg-gradient-to-b ${gradientClass}`,
        className
      )}
      style={{ "--header-h": "4rem" } as React.CSSProperties}
    >
      {/* ロゴ */}
      <Link
        href="/"
        className="text-xl text-white font-bold flex items-center gap-2 py-2 hover:opacity-50"
      >
        {logoUrl && logoUrl.trim() !== "" && (
          <Image
            src={logoUrl}
            alt="ロゴ"
            width={48}
            height={48}
            className="w-12 h-12 object-contain transition-opacity duration-200"
          />
        )}
        VENUS Total Beauty
      </Link>

      <nav className="flex gap-2 ml-auto mr-2">
        {SNS.map(({ name, href, icon: Icon }) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={name}
            className="text-white hover:text-pink-600 transition"
          >
            <Icon />
          </a>
        ))}
      </nav>

      {/* スマホハンバーガー */}
      <div>
        {/* open / onOpenChange を指定 */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-white border-2 border-white " // ← 48 × 48 px
            >
              <Menu size={26} />
            </Button>
          </SheetTrigger>

          <SheetContent
            side="right"
            className={clsx(
              "flex flex-col",
              "bg-gray-100", // ← まずデフォルト背景
              gradient && "bg-gradient-to-b", // gradient があれば方向クラス
              gradient, // 実際の gradient 色クラス
              "[&_[data-radix-sheet-close]]:w-10 [&_[data-radix-sheet-close]]:h-10",
              "[&_[data-radix-sheet-close]_svg]:w-6 [&_[data-radix-sheet-close]_svg]:h-6"
            )}
          >
            <SheetHeader className="pt-4 px-4">
              <SheetTitle className="text-center text-xl text-white">
                Menu
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 flex flex-col justify-center items-center space-y-4 text-center">
              {/* onClick で setOpen(false) */}

              <Link
                href="/products"
                onClick={() => setOpen(false)}
                className="text-lg text-white"
              >
                Work
              </Link>
              <Link
                href="/menu"
                onClick={() => setOpen(false)}
                className="text-lg text-white"
              >
                Price
              </Link>
              <Link
                href="/stores"
                onClick={() => setOpen(false)}
                className="text-lg text-white"
              >
                Access
              </Link>
              <Link
                href="/about"
                onClick={() => setOpen(false)}
                className="text-lg text-white"
              >
                Our Vision
              </Link>
              <Link
                href="/news"
                onClick={() => setOpen(false)}
                className="text-lg text-white"
              >
                Notice
              </Link>
              <Link href="https://lin.ee/KaFE6fA" className="hover:underline text-white">
                Contact
              </Link>
            </div>
            {/* ▼ ログインだけ下に固定 */}
            <div className="p-4">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className={clsx(
                  "block text-center text-lg",
                  gradient ? "text-white" : "text-black" // ← ここで切り替え
                )}
              >
                Administrator Login
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
