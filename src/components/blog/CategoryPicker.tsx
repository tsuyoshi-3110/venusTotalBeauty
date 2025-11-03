// components/blog/CategoryPicker.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { Button } from "@/components/ui/button";
import { DEFAULT_CATEGORIES, type BlogCategory } from "@/lib/blogCategories";
import clsx from "clsx";

type Props = {
  value: string; // "__all" | category.key
  onChange: (key: string) => void;
  showManageButton?: boolean;
  className?: string;
};

export default function CategoryPicker({
  value,
  onChange,
  showManageButton,
  className,
}: Props) {
  const [items, setItems] = useState<BlogCategory[]>(DEFAULT_CATEGORIES);

  useEffect(() => {
    if (!SITE_KEY) return;
    const ref = doc(db, "siteBlogs", SITE_KEY, "meta", "config");
    const unsub = onSnapshot(ref, (snap) => {
      const list = Array.isArray((snap.data() as any)?.categories)
        ? ((snap.data() as any).categories as BlogCategory[])
        : DEFAULT_CATEGORIES;
      const norm = list
        .filter((c) => c && typeof c.key === "string")
        .map((c) => ({ key: c.key, label: c.label ?? c.key }));
      setItems(norm.length ? norm : DEFAULT_CATEGORIES);
    });
    return () => unsub();
  }, []);

  const options = useMemo(
    () => [{ key: "__all", label: "全て" }, ...items],
    [items]
  );

  return (
    <div className={clsx("flex items-center gap-2 ", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9  border px-2 text-sm bg-white/50 rounded-lg"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>

      {showManageButton && (
        <Button asChild variant="secondary" size="sm">
          <a href="/blog/categories">カテゴリ管理</a>
        </Button>
      )}
    </div>
  );
}
