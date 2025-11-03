// app/blog/page.tsx
"use client";

import {
  collection,
  query,
  getDocs,
  where,
  orderBy,
  limit as fbLimit,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import clsx from "clsx";

import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { BlogPost } from "@/types/blog";
import BlogCard from "@/components/blog/BlogCard";
import CategoryPicker from "@/components/blog/CategoryPicker";

import { useThemeGradient } from "@/lib/useThemeGradient";
import { THEMES, type ThemeKey } from "@/lib/themes";
import { type UILang, useUILang } from "@/lib/langsState";

/* ===== 定数 ===== */
const PAGE_SIZE = 20;
const BLOG_T: Record<UILang, string> = {
  ja: "取材はこちら",
  en: "Media / Press Inquiries",
  zh: "媒体采访",
  "zh-TW": "媒體採訪",
  ko: "취재 문의",
  fr: "Demandes de presse",
  es: "Solicitudes de prensa",
  de: "Presseanfragen",
  pt: "Solicitações de imprensa",
  it: "Richieste stampa",
  ru: "Запросы СМИ",
  th: "ติดต่อสื่อมวลชน",
  vi: "Yêu cầu phỏng vấn",
  id: "Permintaan liputan media",
  hi: "मीडिया पूछताछ",
  ar: "استفسارات إعلامية",
};
const DARK_KEYS: ThemeKey[] = ["brandG", "brandH", "brandI"];

/* ===== util ===== */
const createdMillis = (p: any) =>
  p?.createdAt?.toMillis?.() ??
  (typeof p?.createdAt?.seconds === "number" ? p.createdAt.seconds * 1000 : 0);

/* ===== ページ本体 ===== */
export default function BlogListPage() {
  const [user, setUser] = useState<User | null>(null);

  const [selectedKey, setSelectedKey] = useState<string>("__all");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const [loading, setLoading] = useState(false);
  const [noMore, setNoMore] = useState(false);

  const { uiLang } = useUILang();
  const gradient = useThemeGradient();
  const isDark = useMemo(
    () => gradient && DARK_KEYS.some((k) => gradient === THEMES[k]),
    [gradient]
  );

  /* ---- 認証（浮遊の＋ボタン用） ---- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  /* ---- クエリを作る（カテゴリなし/ありで分岐） ---- */
  const makeQuery = useCallback(
    (after?: QueryDocumentSnapshot<DocumentData>) => {
      if (!SITE_KEY) return null;
      const colRef = collection(db, "siteBlogs", SITE_KEY, "posts");

      // 「全件」= createdAt 降順
      if (selectedKey === "__all") {
        return after
          ? query(
              colRef,
              orderBy("createdAt", "desc"),
              startAfter(after),
              fbLimit(PAGE_SIZE)
            )
          : query(colRef, orderBy("createdAt", "desc"), fbLimit(PAGE_SIZE));
      }

      // 「カテゴリ指定」= where(categoryKey == xxx) + createdAt 降順
      // ※ 初回にインデックス要求が出たら、Firestore コンソールのリンクから作成してください
      return after
        ? query(
            colRef,
            where("categoryKey", "==", selectedKey),
            orderBy("createdAt", "desc"),
            startAfter(after),
            fbLimit(PAGE_SIZE)
          )
        : query(
            colRef,
            where("categoryKey", "==", selectedKey),
            orderBy("createdAt", "desc"),
            fbLimit(PAGE_SIZE)
          );
    },
    [selectedKey]
  );

  /* ---- 初回 & カテゴリ変更時：最初のページを取得 ---- */
  const loadFirstPage = useCallback(async () => {
    if (!SITE_KEY) return;
    const q = makeQuery();
    if (!q) return;

    setLoading(true);
    try {
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as BlogPost[];
      // 念のため createdAt で整列（型混在対策）
      const sorted = rows.sort((a, b) => createdMillis(b) - createdMillis(a));
      setPosts(sorted);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setNoMore(snap.size < PAGE_SIZE);
    } catch (err: any) {
      console.error("loadFirstPage error:", err);
      alert(
        err?.code === "failed-precondition"
          ? "このクエリには複合インデックスが必要です。Firestore コンソールに表示されたリンクから作成してください。"
          : "記事の取得に失敗しました。"
      );
      setPosts([]);
      setLastDoc(null);
      setNoMore(true);
    } finally {
      setLoading(false);
    }
  }, [makeQuery]);

  /* ---- 続きを取得 ---- */
  const loadMore = useCallback(async () => {
    if (!SITE_KEY || loading || noMore || !lastDoc) return;
    const q = makeQuery(lastDoc);
    if (!q) return;

    setLoading(true);
    try {
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as BlogPost[];
      const sorted = rows.sort((a, b) => createdMillis(b) - createdMillis(a));
      setPosts((prev) => [...prev, ...sorted]);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      if (snap.size < PAGE_SIZE) setNoMore(true);
    } catch (err: any) {
      console.error("loadMore error:", err);
      alert("続きを取得できませんでした。");
      setNoMore(true);
    } finally {
      setLoading(false);
    }
  }, [makeQuery, lastDoc, loading, noMore]);

  /* ---- 依存変化で初期化＆再取得 ---- */
  useEffect(() => {
    // カテゴリ変更のたびにリセット
    setPosts([]);
    setLastDoc(null);
    setNoMore(false);
    loadFirstPage();
  }, [selectedKey, loadFirstPage]);

  /* ===================== UI ===================== */
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-3xl font-semibold text-white text-outline">
          {BLOG_T[uiLang] ?? BLOG_T.ja}
        </h1>
        <CategoryPicker
          value={selectedKey}
          onChange={setSelectedKey}
          showManageButton={!!user}
        />
      </div>

      {posts.length === 0 ? (
        <p
          className={clsx(
            "text-sm",
            isDark ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {loading ? "読み込み中…" : "該当する投稿がありません。"}
        </p>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-1 justify-items-center">
            {posts.map((p) => (
              <BlogCard key={p.id} post={p} className="w-[90%]" />
            ))}
          </div>

          <div className="flex justify-center py-6">
            {!noMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-4 py-2 rounded-md bg-black/80 text-white hover:bg-black transition"
              >
                {loading ? "読み込み中…" : "もっと表示"}
              </button>
            )}
          </div>
        </>
      )}

      {user && (
        <Link
          href="/blog/new"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg transition-transform transform hover:scale-110 active:scale-95"
        >
          <span className="text-3xl leading-none">＋</span>
        </Link>
      )}
    </div>
  );
}
