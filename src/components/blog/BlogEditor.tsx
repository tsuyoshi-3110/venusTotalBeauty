// components/blog/BlogEditor.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import type { BlogBlock } from "@/types/blog";
import { useRouter } from "next/navigation";
import {
  ref as sref,
  deleteObject,
  getDownloadURL,
  uploadBytes,
} from "firebase/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useThemeGradient } from "@/lib/useThemeGradient";
import { THEMES, type ThemeKey } from "@/lib/themes";
import clsx from "clsx";
import BlockEditor from "./BlockEditor";
import { BusyOverlay } from "@/components/BusyOverlay";
import { LANGS, type LangKey } from "@/lib/langs";
import {
  loadCategories,
  saveCategories,
  uniqueKeyForLabel,
  type BlogCategory,
} from "@/lib/blogCategories";

const DARK_KEYS: ThemeKey[] = ["brandH", "brandG", "brandI"];

function pruneUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(pruneUndefined) as unknown as T;
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = pruneUndefined(v);
    }
    return out as T;
  }
  return obj;
}
function blockHasKey(
  b: BlogBlock,
  key: "text" | "caption" | "title"
): b is BlogBlock & Record<typeof key, string> {
  return typeof (b as any)[key] === "string";
}
function isMedia(b: BlogBlock): b is BlogBlock & {
  type: "image" | "video";
  path?: string;
  url?: string;
  title?: string;
  caption?: string;
} {
  return b.type === "image" || b.type === "video";
}
async function moveTempToPost(
  postId: string,
  blocks: BlogBlock[],
  onProgress?: (pct: number, label: string) => void
): Promise<BlogBlock[]> {
  const targets = blocks.filter(
    (b) =>
      isMedia(b) &&
      typeof b.path === "string" &&
      b.path.includes("/posts/temp/")
  );
  let moved = 0;
  const total = targets.length;
  const emit = (label: string) =>
    onProgress?.(total === 0 ? 100 : Math.round((moved / total) * 100), label);
  const result: BlogBlock[] = [];
  for (const b of blocks) {
    if (!isMedia(b) || !b.path || !b.path.includes("/posts/temp/")) {
      result.push(b);
      continue;
    }
    emit(`メディア移動中… ${moved + 1}/${total}`);
    const oldRef = sref(storage, b.path);
    const blob = await fetch(await getDownloadURL(oldRef)).then((r) =>
      r.blob()
    );
    const newPath = b.path.replace("/posts/temp/", `/posts/${postId}/`);
    const newRef = sref(storage, newPath);
    await uploadBytes(newRef, blob, { contentType: blob.type });
    const newUrl = await getDownloadURL(newRef);
    try {
      await deleteObject(oldRef);
    } catch {}
    result.push({ ...(b as any), path: newPath, url: newUrl } as BlogBlock);
    moved++;
    emit(`メディア移動中… ${moved}/${total}`);
  }
  emit("最終処理中…");
  return result;
}
type TranslatedPost = { lang: LangKey; title: string; blocks: BlogBlock[] };
async function translatePost(
  baseTitle: string,
  baseBlocks: BlogBlock[],
  target: LangKey
): Promise<TranslatedPost> {
  const SEP = "\n---\n";
  const items: Array<
    | { kind: "title" }
    | { kind: "text"; idx: number }
    | { kind: "caption"; idx: number }
    | { kind: "mediaTitle"; idx: number }
  > = [];
  const payload: string[] = [];
  if (baseTitle.trim()) {
    items.push({ kind: "title" });
    payload.push(baseTitle);
  }
  baseBlocks.forEach((b, idx) => {
    if (blockHasKey(b, "text") && b.text.trim()) {
      items.push({ kind: "text", idx });
      payload.push(b.text);
    }
    if (blockHasKey(b, "caption") && b.caption.trim()) {
      items.push({ kind: "caption", idx });
      payload.push(b.caption);
    }
    if (isMedia(b) && blockHasKey(b, "title") && b.title.trim()) {
      items.push({ kind: "mediaTitle", idx });
      payload.push(b.title);
    }
  });
  if (payload.length === 0)
    return { lang: target, title: baseTitle, blocks: baseBlocks };
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "", body: payload.join(SEP), target }),
  });
  if (!res.ok) throw new Error("翻訳APIエラー");
  const data = (await res.json()) as { body?: string };
  const parts = String(data.body ?? "").split(SEP);
  let p = 0;
  let tTitle = baseTitle;
  const outBlocks: BlogBlock[] = baseBlocks.map((b) => ({ ...b }));
  if (items[0]?.kind === "title")
    tTitle = (parts[p++] ?? "").trim() || baseTitle;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === "title") continue;
    const translated = (parts[p++] ?? "").trim();
    if (!translated) continue;
    const idx = (it as any).idx as number;
    const b = outBlocks[idx] as any;
    if (it.kind === "text") b.text = translated;
    if (it.kind === "caption") b.caption = translated;
    if (it.kind === "mediaTitle") b.title = translated;
  }
  return { lang: target, title: tTitle, blocks: outBlocks };
}

type Props = { postId?: string };

export default function BlogEditor({ postId }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState<string>("");
  const [blocks, setBlocks] = useState<BlogBlock[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [categoryKey, setCategoryKey] = useState<string>("");
  const [newCatLabel, setNewCatLabel] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);

  const gradient = useThemeGradient();
  const isDark = useMemo(
    () =>
      !!gradient &&
      (Object.keys(THEMES) as ThemeKey[]).some(
        (k) => THEMES[k] === gradient && DARK_KEYS.includes(k)
      ),
    [gradient]
  );

  const categoryLabel = useMemo(
    () => categories.find((c) => c.key === categoryKey)?.label ?? "",
    [categories, categoryKey]
  );

  useEffect(() => {
    (async () => {
      if (!SITE_KEY) return; // ← ガードは残す
      // ① カテゴリー
      let cats: BlogCategory[] = [];
      try {
        cats = await loadCategories(SITE_KEY);
        setCategories(cats);
      } catch {
        cats = [];
        setCategories([]);
      }

      // ② 記事
      if (!postId) return;
      const refDoc = doc(db, "siteBlogs", SITE_KEY, "posts", postId);
      const snap = await getDoc(refDoc);
      if (!snap.exists()) return;
      const d = snap.data() as any;

      // ...（タイトル・ブロック復元はそのまま）...

      // ③ カテゴリーキー解決
      const k0: string =
        (typeof d.categoryKey === "string" && d.categoryKey) ||
        (typeof d.category?.key === "string" && d.category.key) ||
        "";
      const lbl: string =
        (typeof d.categoryLabel === "string" && d.categoryLabel) ||
        (typeof d.category === "string" && d.category) ||
        "";

      if (k0) setCategoryKey(k0);
      else if (lbl) {
        const local = cats.find((c) => c.label === lbl)?.key;
        if (local) setCategoryKey(local);
      }
    })();
  }, [postId]);

  const quickAddCategory = async () => {
    const label = newCatLabel.trim();
    if (!label) return;
    const key = uniqueKeyForLabel(label, categories);
    const next = [...categories, { key, label }];
    setCategories(next);
    setCategoryKey(key);
    setNewCatLabel("");
    if (SITE_KEY) await saveCategories(SITE_KEY, next);
  };

  const save = async () => {
    if (!title.trim()) {
      alert("タイトルを入力してください。");
      return;
    }
    setBusy(true);
    setUploadPercent(5);
    try {
      if (postId) {
        const moved = await moveTempToPost(postId, blocks, (pct) => {
          const scaled =
            10 + Math.round((Math.max(0, Math.min(100, pct)) / 100) * 70);
          setUploadPercent(scaled);
        });
        const tAll: TranslatedPost[] = await Promise.all(
          (LANGS.map((l) => l.key) as LangKey[]).map((lang) =>
            translatePost(title, moved, lang)
          )
        );
        const plain = moved
          .filter((b) => blockHasKey(b, "text"))
          .map((b) => (b as any).text || "")
          .join("\n\n")
          .trim();
        await updateDoc(
          doc(db, "siteBlogs", SITE_KEY, "posts", postId),
          pruneUndefined({
            base: { title, blocks: moved },
            t: tAll,
            title,
            body: plain,
            blocks: moved,
            categoryKey: categoryKey || null,
            categoryLabel: categoryLabel || null, // ← 必ず保存
            updatedAt: serverTimestamp(),
          })
        );
      } else {
        const created = await addDoc(
          collection(db, "siteBlogs", SITE_KEY, "posts"),
          {
            base: { title: title || "", blocks: [] as BlogBlock[] },
            t: [] as TranslatedPost[],
            title: title || "",
            body: "",
            blocks: [] as BlogBlock[],
            categoryKey: categoryKey || null,
            categoryLabel: categoryLabel || null, // ← 必ず保存
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
        );
        const moved = await moveTempToPost(created.id, blocks, (pct) => {
          const scaled =
            15 + Math.round((Math.max(0, Math.min(100, pct)) / 100) * 60);
          setUploadPercent(scaled);
        });
        const tAll: TranslatedPost[] = await Promise.all(
          (LANGS.map((l) => l.key) as LangKey[]).map((lang) =>
            translatePost(title, moved, lang)
          )
        );
        const plain = moved
          .filter((b) => blockHasKey(b, "text"))
          .map((b) => (b as any).text || "")
          .join("\n\n")
          .trim();
        await updateDoc(
          created,
          pruneUndefined({
            base: { title, blocks: moved },
            t: tAll,
            title,
            body: plain,
            blocks: moved,
            categoryKey: categoryKey || null,
            categoryLabel: categoryLabel || null, // ← 必ず保存
            updatedAt: serverTimestamp(),
          })
        );
      }
      setUploadPercent(100);
      setTimeout(() => {
        setUploadPercent(null);
        setBusy(false);
        router.push("/blog");
      }, 250);
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。");
      setUploadPercent(null);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!postId) return;
    if (!confirm("この記事を削除しますか？（メディアも削除されます）")) return;
    setBusy(true);
    setUploadPercent(20);
    try {
      for (const b of blocks) {
        if (isMedia(b) && b.path) {
          try {
            await deleteObject(sref(storage, b.path));
          } catch {}
        }
      }
      await deleteDoc(doc(db, "siteBlogs", SITE_KEY, "posts", postId));
      setUploadPercent(100);
      setTimeout(() => {
        setUploadPercent(null);
        setBusy(false);
        router.push("/blog");
      }, 200);
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました。");
      setUploadPercent(null);
      setBusy(false);
    }
  };

  return (
    <div
      className={clsx(
        "space-y-6 bg-white/20 rounded-2xl shadow",
        isDark ? "text-white" : "text-black"
      )}
    >
      <BusyOverlay uploadingPercent={uploadPercent} saving={busy} />
      <div className="p-5">
        <div className="grid gap-2">
          <label className="text-sm font-medium">タイトル</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="タイトル"
            className={isDark ? "text-white" : "text-black"}
            disabled={busy}
          />
        </div>

        <div className="grid gap-2 mt-4">
          <label className="text-sm font-medium">カテゴリー</label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={categoryKey}
              onChange={(e) => setCategoryKey(e.target.value)}
              className="h-9 rounded-md border px-2 text-sm"
              disabled={busy}
            >
              <option value="">（未選択）</option>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            <div className="text-xs opacity-70">※ 未選択でも公開できます</div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="その場で新しいカテゴリーを作成（表示名）"
              value={newCatLabel}
              onChange={(e) => setNewCatLabel(e.target.value)}
              disabled={busy}
            />
            <Button
              type="button"
              onClick={quickAddCategory}
              disabled={!newCatLabel.trim() || busy}
            >
              カテゴリー作成
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-5 mb-5">
          <Button onClick={save} disabled={busy}>
            {postId ? "更新" : "公開"}
          </Button>
          {postId && (
            <Button variant="destructive" onClick={remove} disabled={busy}>
              削除
            </Button>
          )}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium">本文</label>
          <BlockEditor
            value={blocks}
            onChange={setBlocks}
            postIdForPath={postId ?? null}
          />
        </div>
      </div>
    </div>
  );
}
