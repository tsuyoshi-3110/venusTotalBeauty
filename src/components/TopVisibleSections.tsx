// TopVisibleSections.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore"; // ← onSnapshot を使う
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

import ProductsClient from "./products/ProductsClient";
import StaffClient from "./StaffClient";
import AreasClient from "./AreasClient";
import StoresClient from "./StoresClient";
import AboutClient from "./AboutClient";
import MenuPageClient from "./MenuPageClient";
import NewsClient from "./NewsClient";
import ProjectsClient from "./ProjectsClient";
import HoursClient from "./HoursClient";

const META_REF = doc(db, "siteSettingsEditable", SITE_KEY);

// トップ表示候補に限定（★ "hours" を追加）
const TOP_DISPLAYABLE_ITEMS = [
  "products",
  "pricing",
  "staffs",
  "areas",
  "stores",
  "story",
  "news",
  "hours",
] as const;

const MENU_ITEMS: { key: string; label: string }[] = [
  { key: "products", label: "商品一覧" },
  { key: "projects", label: "施工実績" },
  { key: "pricing", label: "メニュー" },
  { key: "staffs", label: "スタッフ" },
  { key: "areas", label: "対応エリア" },
  { key: "stores", label: "店舗一覧" },
  { key: "story", label: "私たちの思い" },
  { key: "news", label: "お知らせ" },
  { key: "hours", label: "営業時間" }, // ★ 追加
];

function renderSection(key: string) {
  switch (key) {
    case "products":
      return <ProductsClient />;
    case "projects":
      return <ProjectsClient />;
    case "pricing":
      return <MenuPageClient />;
    case "staffs":
      return <StaffClient />;
    case "areas":
      return <AreasClient />;
    case "stores":
      return <StoresClient />;
    case "story":
      return <AboutClient />;
    case "news":
      return <NewsClient />;
    case "hours":
      return <HoursClient />;
    default:
      return null;
  }
}

export default function TopVisibleSections() {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Firestore をリアルタイム購読
  useEffect(() => {
    const unsub = onSnapshot(META_REF, (snap) => {
      const data = snap.data() as {
        activeMenuKeys?: string[];
        visibleMenuKeys?: string[];
      };
      setActiveKeys(Array.isArray(data?.activeMenuKeys) ? data!.activeMenuKeys! : []);
      setVisibleKeys(Array.isArray(data?.visibleMenuKeys) ? data!.visibleMenuKeys! : []);
    });
    return () => unsub();
  }, []);

  // ログイン状態監視
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => setIsLoggedIn(!!user));
    return () => unsub();
  }, []);

  // 両方を満たすキーだけ表示（可視候補 ∩ アクティブ ∩ トップ候補）
  const keysToShow = useMemo(
    () =>
      activeKeys.filter(
        (k) =>
          visibleKeys.includes(k) &&
          (TOP_DISPLAYABLE_ITEMS as readonly string[]).includes(k)
      ),
    [activeKeys, visibleKeys]
  );

  if (isLoggedIn) {
    return (
      <div className="py-8 text-center text-gray-500">
        ログアウト時に選択したページは表示されます
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {MENU_ITEMS.filter((item) => keysToShow.includes(item.key)).map((item) => (
        <section key={item.key}>{renderSection(item.key)}</section>
      ))}
    </div>
  );
}
