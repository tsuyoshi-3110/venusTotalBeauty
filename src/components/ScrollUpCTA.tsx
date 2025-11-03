"use client";

import Link from "next/link";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { useThemeGradient } from "@/lib/useThemeGradient";

type Props = {
  href?: string;
  label?: string;
  className?: string;
};

export default function ScrollUpCTA({
  href = "/contact",
  label = "無料相談・お問い合わせ",
  className,
}: Props) {
  const gradient = useThemeGradient();

  return (
    <div
      className={clsx(
        className
      )}
    >
      <Link href={href} prefetch className="block">
        <Button
          className={clsx(
            "h-12 px-5 rounded-2xl shadow-2xl font-bold text-white text-outline",
            gradient
              ? ["bg-gradient-to-r", gradient, "hover:brightness-110"]
              : "bg-emerald-600 hover:bg-emerald-700"
          )}
        >
          {label}
        </Button>
      </Link>
    </div>
  );
}
