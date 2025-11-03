// /lib/blogCategories.ts
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type BlogCategory = { key: string; label: string };

export const DEFAULT_CATEGORIES: BlogCategory[] = [
  { key: "news", label: "お知らせ" },
  { key: "campaign", label: "キャンペーン" },
  { key: "blog", label: "取材はこちら" },
  { key: "column", label: "コラム" },
];

// 日本語でも壊れない slug 化。
// 1) ASCII 化を試みる → 2) 失敗したら label をそのまま key として使う（Firestoreの == 比較は問題なし）
export function slugifyLike(label: string): string {
  const s = (label ?? "").toString().trim();
  if (!s) return "";
  const ascii = s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\-_\s]/gu, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  // ASCII側が短すぎる/空なら、ラベルを key として採用（日本語キー許容）
  return ascii && ascii.length >= 2 ? ascii : s;
}

export function uniqueKeyForLabel(label: string, existing: BlogCategory[]): string {
  const base = slugifyLike(label) || label.trim();
  let key = base;
  let i = 2;
  const has = (k: string) => existing.some((c) => c.key === k);
  while (has(key)) key = `${base}-${i++}`;
  return key;
}

export async function loadCategories(siteKey: string): Promise<BlogCategory[]> {
  if (!siteKey) return DEFAULT_CATEGORIES;
  const ref = doc(db, "siteBlogs", siteKey, "meta", "config");
  const snap = await getDoc(ref);
  const arr = Array.isArray((snap.data() as any)?.categories)
    ? ((snap.data() as any).categories as BlogCategory[])
    : DEFAULT_CATEGORIES;
  const norm = arr
    .filter((c) => c && typeof c.key === "string")
    .map((c) => ({ key: c.key, label: c.label ?? c.key }));
  return norm.length ? norm : DEFAULT_CATEGORIES;
}

export async function saveCategories(siteKey: string, items: BlogCategory[]): Promise<void> {
  if (!siteKey) return;
  const ref = doc(db, "siteBlogs", siteKey, "meta", "config");
  await setDoc(ref, { categories: items.map((c) => ({ key: c.key, label: c.label ?? c.key })) }, { merge: true });
}
