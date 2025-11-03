"use client";

import CategoryManager from "@/components/blog/CategoryManager";
import { useThemeGradient } from "@/lib/useThemeGradient";
import { THEMES, ThemeKey } from "@/lib/themes";
import clsx from "clsx";

const DARK_KEYS: ThemeKey[] = ["brandH", "brandG", "brandI"];

export default function BlogCategoriesPage() {
  const gradient = useThemeGradient();
  const isDark =
    !!gradient &&
    (Object.keys(THEMES) as ThemeKey[]).some(
      (k) => THEMES[k] === gradient && DARK_KEYS.includes(k)
    );

  return (
    <div className={clsx("max-w-3xl mx-auto p-4 space-y-6", isDark ? "text-white" : "text-black")}>
      <h1 className="text-xl font-bold">カテゴリー管理</h1>
      <CategoryManager />
    </div>
  );
}
