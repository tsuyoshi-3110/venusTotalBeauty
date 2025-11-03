"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import { Pin, Plus } from "lucide-react";
import { v4 as uuid } from "uuid";
import imageCompression from "browser-image-compression";

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  CollectionReference,
  DocumentData,
  writeBatch,
  deleteDoc,
  orderBy,
  query,
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

import { useThemeGradient } from "@/lib/useThemeGradient";
import clsx from "clsx";
import { ThemeKey, THEMES } from "@/lib/themes";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import SortableItem from "./SortableItem";
import { motion, useInView } from "framer-motion";

import { type Product } from "@/types/Product";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { LANGS, type LangKey } from "@/lib/langs";
import { useUILang } from "@/lib/atoms/uiLangAtom";

// ✅ 共通ユーティリティ（ファイルタイプ）
import {
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
  extFromMime,
} from "@/lib/fileTypes";

// ✅ 共通 UI（オーバーレイ）
import { BusyOverlay } from "./BusyOverlay";
import { Input } from "./ui/input";
import { UILang } from "@/lib/langsState";

/* ==============================
   設定
============================== */
type MediaType = "image" | "video";

const MAX_VIDEO_SEC = 30;
const COL_PATH = `siteStaffs/${SITE_KEY}/items`;

/* ==============================
   多言語型
============================== */
type Base = { title: string; body: string };
type Tr = { lang: LangKey; title: string; body: string };

/** Firestoreのスタッフドキュメント（互換のため top-level title/bodyも持つ） */
type StaffDoc = Product & {
  base?: Base;
  t?: Tr[];
};

/** 表示用：UI言語で値を取り出し（なければ原文フォールバック） */
function displayOf(
  p: StaffDoc,
  ui: ReturnType<typeof useUILang>["uiLang"]
): Base {
  if (ui === "ja") {
    return {
      title: p.base?.title ?? p.title ?? "",
      body: p.base?.body ?? p.body ?? "",
    };
  }
  const hit = p.t?.find((x) => x.lang === ui);
  return {
    title: hit?.title ?? p.base?.title ?? p.title ?? "",
    body: hit?.body ?? p.base?.body ?? p.body ?? "",
  };
}

/** 全言語翻訳（失敗言語は除外） */
async function translateAll(titleJa: string, bodyJa: string): Promise<Tr[]> {
  const jobs: Promise<Tr>[] = LANGS.map(async (l) => {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleJa, body: bodyJa, target: l.key }),
    });
    if (!res.ok) throw new Error(`translate error: ${l.key}`);
    const data = (await res.json()) as { title?: string; body?: string };
    return {
      lang: l.key,
      title: (data.title ?? "").trim(),
      body: (data.body ?? "").trim(),
    };
  });

  const settled = await Promise.allSettled(jobs);
  return settled
    .filter((r): r is PromiseFulfilledResult<Tr> => r.status === "fulfilled")
    .map((r) => r.value);
}

/* ===== ページ見出し（スタッフ） ===== */
const PAGE_TITLE_T: Record<UILang, string> = {
  ja: "スタッフ",
  en: "Staff",
  zh: "员工",
  "zh-TW": "員工",
  ko: "직원",
  fr: "Équipe",
  es: "Equipo",
  de: "Team",
  pt: "Equipe",
  it: "Staff",
  ru: "Команда",
  th: "พนักงาน",
  vi: "Đội ngũ",
  id: "Tim",
  hi: "टीम",
  ar: "الفريق",
};

/* ==============================
   本体
============================== */
export default function StaffClient() {
  const { uiLang } = useUILang();

  const [list, setList] = useState<StaffDoc[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // フォーム
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<StaffDoc | null>(null);
  const [titleJa, setTitleJa] = useState("");
  const [bodyJa, setBodyJa] = useState("");

  // メディア
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const uploading = progress !== null;

  // 画面内のカードのロード状態（ふわっと表示用）
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());

  // AI 生成（紹介文）
  const [aiLoading, setAiLoading] = useState(false);
  const [keywords, setKeywords] = useState(["", "", ""]);
  const [showKeywordInput, setShowKeywordInput] = useState(false);

  // 保存インジケータ
  const [saving, setSaving] = useState(false);

  const pageTitle = PAGE_TITLE_T[uiLang] ?? PAGE_TITLE_T.ja;

  // テーマ
  const gradient = useThemeGradient();
  const isDark = useMemo(() => {
    const darks: ThemeKey[] = ["brandG", "brandH", "brandI"];
    return !!gradient && darks.some((k) => gradient === THEMES[k]);
  }, [gradient]);

  // DnD センサー
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  // Firestore コレクション
  const colRef: CollectionReference<DocumentData> = useMemo(
    () => collection(db, COL_PATH),
    []
  );

  /* 権限 */
  useEffect(() => onAuthStateChanged(auth, (u) => setIsAdmin(!!u)), []);

  /* 取得（order昇順・後方互換） */
  useEffect(() => {
    const q = query(colRef, orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows: StaffDoc[] = snap.docs.map((d) => {
        const data = d.data() as any;
        const base: Base = data.base ?? {
          title: data.title ?? "",
          body: data.body ?? "",
        };
        const t: Tr[] = Array.isArray(data.t)
          ? data.t.map((x: any) => ({
              lang: x.lang as LangKey,
              title: (x.title ?? "").trim(),
              body: (x.body ?? "").trim(),
            }))
          : [];

        return {
          id: d.id,
          // 互換のため top-level を維持
          title: data.title ?? base.title,
          body: data.body ?? base.body,
          price: typeof data.price === "number" ? data.price : 0, // Product型互換
          mediaURL: data.mediaURL ?? data.imageURL ?? "",
          mediaType: (data.mediaType as MediaType) ?? "image",
          originalFileName: data.originalFileName,
          taxIncluded: data.taxIncluded ?? true,
          order: data.order ?? 9999,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          // 多言語
          base,
          t,
        } as StaffDoc;
      });
      rows.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
      setList(rows);
    });
    return () => unsub();
  }, [colRef]);

  /* 並べ替え */
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = list.findIndex((item) => item.id === active.id);
    const newIndex = list.findIndex((item) => item.id === over.id);
    const newList = arrayMove(list, oldIndex, newIndex);
    setList(newList);

    const batch = writeBatch(db);
    newList.forEach((item, index) => {
      batch.update(doc(colRef, item.id), { order: index });
    });
    await batch.commit();
  };

  /* フォーム開閉 */
  const resetFields = () => {
    setEditing(null);
    setTitleJa("");
    setBodyJa("");
    setFile(null);
    setKeywords(["", "", ""]);
  };

  const openAdd = () => {
    if (uploading || saving) return;
    resetFields();
    setFormMode("add");
  };

  const openEdit = (p: StaffDoc) => {
    if (uploading || saving) return;
    setEditing(p);
    setTitleJa(p.base?.title ?? p.title ?? "");
    setBodyJa(p.base?.body ?? p.body ?? "");
    setFile(null);
    setFormMode("edit");
  };

  const closeForm = () => {
    if (uploading || saving) return;
    setTimeout(() => {
      resetFields();
      setFormMode(null);
    }, 100);
  };

  /* 紹介文 AI 生成（機能は残します） */
  const generateBodyWithAI = async () => {
    const validKeywords = keywords.filter((k) => k.trim() !== "");
    if (!titleJa || validKeywords.length < 1) {
      alert("名前（タイトル原文）とキーワードを1つ以上入力してください");
      return;
    }

    try {
      setAiLoading(true);
      const res = await fetch("/api/generate-intro-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: titleJa, keywords: validKeywords }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成に失敗");

      setBodyJa((data.text as string) ?? "");
      setKeywords(["", "", ""]);
      setShowKeywordInput(false);
    } catch (err) {
      alert("紹介文の生成に失敗しました");
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  /* 保存（全言語へ自動翻訳して保存） */
  const saveProduct = async () => {
    if (uploading || saving) return;
    if (!titleJa.trim()) return alert("名前は必須です");
    if (formMode === "add" && !file) return alert("メディアを選択してください");

    setSaving(true);
    try {
      const id = editing?.id ?? uuid();
      let mediaURL = editing?.mediaURL ?? "";
      let mediaType: MediaType = editing?.mediaType ?? "image";
      let originalFileName = editing?.originalFileName;

      // メディアアップロード
      if (file) {
        const isImage = IMAGE_MIME_TYPES.includes(file.type);
        const isVideo = VIDEO_MIME_TYPES.includes(file.type);

        if (!isImage && !isVideo) {
          alert("対応形式：画像（JPEG/PNG/WEBP/GIF）／動画（MP4/MOV/WebM 他）");
          setSaving(false);
          return;
        }

        mediaType = isVideo ? "video" : "image";

        // 画像はJPEG圧縮で保存するため拡張子はjpg固定、動画はMIMEから拡張子を決定
        const ext = isVideo ? extFromMime(file.type) : "jpg";

        const uploadFile = isVideo
          ? file
          : await imageCompression(file, {
              maxWidthOrHeight: 1200,
              maxSizeMB: 0.7,
              useWebWorker: true,
              fileType: "image/jpeg",
              initialQuality: 0.8,
            });

        const sref = storageRef(
          getStorage(),
          `products/public/${SITE_KEY}/${id}.${ext}`
        );
        const task = uploadBytesResumable(sref, uploadFile, {
          contentType: isVideo ? file.type : "image/jpeg",
        });

        setProgress(0);
        await new Promise<void>((resolve, reject) => {
          task.on(
            "state_changed",
            (s) => {
              const pct = Math.round((s.bytesTransferred / s.totalBytes) * 100);
              setProgress(pct);
            },
            reject,
            resolve
          );
        });

        const downloadURL = await getDownloadURL(sref);
        if (!downloadURL) throw new Error("画像URLの取得に失敗しました");

        mediaURL = `${downloadURL}?v=${uuid()}`;
        originalFileName = file.name;
        setProgress(null);

        if (formMode === "edit" && editing) {
          // 旧拡張子掃除（編集時のみ）
          const oldExt =
            editing.originalFileName?.split(".").pop()?.toLowerCase() ??
            (editing.mediaType === "video" ? "mp4" : "jpg");
          if (oldExt && oldExt !== ext) {
            await deleteObject(
              storageRef(
                getStorage(),
                `products/public/${SITE_KEY}/${id}.${oldExt}`
              )
            ).catch(() => {});
          }
        }
      }

      // ✅ 全言語翻訳（原文：titleJa/bodyJa）
      const t = await translateAll(titleJa.trim(), bodyJa.trim());

      // Firestore ペイロード
      const base: Base = { title: titleJa.trim(), body: bodyJa.trim() };
      const payload: Partial<StaffDoc> & {
        base: Base;
        t: Tr[];
        title: string;
        body: string;
        mediaURL: string;
        mediaType: MediaType;
        price: number; // Product型互換
        originalFileName?: string;
      } = {
        base,
        t,
        // 互換用の top-level
        title: base.title,
        body: base.body,
        // メディア
        mediaURL,
        mediaType,
        originalFileName,
        // Staff では価格は使わないが、外部の Product 型互換のため 0 を保存
        price: 0,
      };

      if (formMode === "edit" && editing) {
        await updateDoc(doc(colRef, id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      } else {
        // 末尾へ追加（現在の最大 order の次）
        const tail = (list.at(-1)?.order ?? list.length - 1) + 1;
        await addDoc(colRef, {
          ...payload,
          createdAt: serverTimestamp(),
          order: tail,
        });
      }

      closeForm();
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。対応形式や容量をご確認ください。");
      setProgress(null);
    } finally {
      setSaving(false);
    }
  };

  /* 削除 */
  const remove = async (p: StaffDoc) => {
    if (uploading || saving) return;
    if (!confirm(`「${p.title}」を削除しますか？`)) return;

    await deleteDoc(doc(colRef, p.id));
    if (p.mediaURL) {
      const ext =
        p.originalFileName?.split(".").pop()?.toLowerCase() ??
        (p.mediaType === "video" ? "mp4" : "jpg");
      await deleteObject(
        storageRef(getStorage(), `products/public/${SITE_KEY}/${p.id}.${ext}`)
      ).catch(() => {});
    }
  };

  /* 動画の長さチェックつきファイル選択 */
  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const isVideo = f.type.startsWith("video/");
    if (!isVideo) {
      setFile(f);
      return;
    }

    const blobURL = URL.createObjectURL(f);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.src = blobURL;

    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(blobURL);
      if (vid.duration > MAX_VIDEO_SEC) {
        alert(`動画は ${MAX_VIDEO_SEC} 秒以内にしてください`);
        (e.target as HTMLInputElement).value = "";
        return;
      }
      setFile(f);
    };
  };

  return (
    <main className="max-w-5xl mx-auto p-4 pt-5">
      {/* ✅ 共通 BusyOverlay（進捗＆保存中） */}
      <BusyOverlay uploadingPercent={progress} saving={saving} />

      <h1
        className="text-3xl font-semibold text-white text-outline mb-10"
        aria-label={pageTitle}
      >
        {pageTitle}
      </h1>

      {/* ====== 並べ替えリスト ====== */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={list.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-1 lg:grid-cols-1 items-stretch w-full max-w-2xl mx-auto">
            {list.map((p) => {
              const loc = displayOf(p, uiLang);
              return (
                <SortableItem key={p.id} product={p}>
                  {({ listeners, attributes, isDragging }) => (
                    <StaffCard
                      product={p}
                      locTitle={loc.title}
                      locBody={loc.body}
                      isAdmin={isAdmin}
                      isDragging={isDragging}
                      isLoaded={loadedIds.has(p.id)}
                      // ✅ ここで props 経由
                      isDark={isDark}
                      gradient={gradient!}
                      listeners={listeners}
                      attributes={attributes}
                      onEdit={openEdit}
                      onRemove={remove}
                      onMediaLoad={() =>
                        setLoadedIds((prev) => new Set(prev).add(p.id))
                      }
                      uploading={uploading || saving}
                    />
                  )}
                </SortableItem>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* ====== 追加 FAB ====== */}
      {isAdmin && formMode === null && (
        <button
          onClick={openAdd}
          aria-label="新規追加"
          disabled={uploading || saving}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg hover:bg-pink-700 active:scale-95 transition disabled:opacity-50 cursor-pointer"
        >
          <Plus size={28} />
        </button>
      )}

      {/* ====== フォーム（原文のみ編集） ====== */}
      {isAdmin && formMode && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-white rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-center">
              {formMode === "edit"
                ? "スタッフプロフィールを編集"
                : "スタッフプロフィール追加"}
            </h2>

            <Input
              placeholder="名前（日本語。改行可）"
              value={titleJa}
              onChange={(e) => setTitleJa(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              disabled={uploading || saving}
            />

            <textarea
              placeholder="紹介文（日本語）"
              value={bodyJa}
              onChange={(e) => setBodyJa(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              rows={4}
              disabled={uploading || saving}
            />

            {/* ✅ AIで紹介文生成（機能維持） */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowKeywordInput(!showKeywordInput)}
                className="px-3 py-2 bg-purple-600 text-white rounded flex items-center justify-center gap-1 disabled:opacity-50"
                disabled={uploading || saving}
              >
                AIで紹介文を作成
              </button>
              {showKeywordInput && (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <input
                      key={i}
                      type="text"
                      placeholder={`キーワード${i + 1}`}
                      className="w-full border px-3 py-2 rounded"
                      value={keywords[i]}
                      onChange={(e) => {
                        const next = [...keywords];
                        next[i] = e.target.value;
                        setKeywords(next);
                      }}
                      disabled={uploading || saving}
                    />
                  ))}
                  <button
                    onClick={generateBodyWithAI}
                    className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-50 flex items-center justify-center gap-2"
                    disabled={aiLoading || uploading || saving}
                  >
                    {aiLoading ? "生成中..." : "紹介文を生成する"}
                  </button>
                </div>
              )}
            </div>

            <label className="text-sm font-medium">
              画像 / 動画（{MAX_VIDEO_SEC}秒以内）
            </label>
            <input
              type="file"
              accept={[...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES].join(",")}
              onChange={onFileChange}
              className="bg-gray-500 text-white w-full h-10 px-3 py-1 rounded"
              disabled={uploading || saving}
            />
            {formMode === "edit" && editing?.originalFileName && (
              <p className="text-sm text-gray-600">
                現在のファイル: {editing.originalFileName}
              </p>
            )}

            <div className="flex gap-2 justify-center">
              <button
                onClick={saveProduct}
                disabled={uploading || saving}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
              >
                {saving ? "保存中…" : formMode === "edit" ? "更新" : "追加"}
              </button>
              <button
                onClick={closeForm}
                disabled={uploading || saving}
                className="px-4 py-2 bg-gray-500 text-white rounded disabled:opacity-50"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ==============================
   カード
============================== */
interface StaffCardProps {
  product: StaffDoc; // 並べ替え用に id 等が必要
  locTitle: string; // 表示言語に合わせたタイトル
  locBody: string; // 表示言語に合わせた本文
  isAdmin: boolean;
  isDragging: boolean;
  isLoaded: boolean;
  isDark: boolean;
  gradient: string;
  listeners: any;
  attributes: any;
  onEdit: (p: StaffDoc) => void;
  onRemove: (p: StaffDoc) => void;
  onMediaLoad: () => void;
  uploading: boolean;
}

export function StaffCard({
  product: p,
  locTitle,
  locBody,
  isAdmin,
  isDragging,
  isLoaded,
  gradient,
  listeners,
  attributes,
  onEdit,
  onRemove,
  onMediaLoad,
  uploading,
}: StaffCardProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -150px 0px" });

  return (
    <motion.div
      ref={ref}
      layout={isDragging ? false : true}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={
        isDragging ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }
      }
      style={isDragging ? { transform: undefined } : undefined}
      className={clsx(
        "flex flex-col h-full border rounded-lg shadow relative transition-colors duration-200",
        "bg-gradient-to-b",
        gradient,
        isDragging ? "z-50 shadow-xl" : "bg-white",
        "cursor-default",
        "overflow-visible" // ← ここで外にはみ出したピンを隠さない
      )}
    >
      {/* 🔽 ピンを上部中央に配置 */}
      {auth.currentUser !== null && (
        <div
          {...attributes}
          {...listeners}
          onTouchStart={(e) => e.preventDefault()}
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2
                     z-20 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div
            className="w-10 h-10 bg-white/95 border border-black/10
                          text-gray-700 rounded-full flex items-center justify-center shadow-lg"
          >
            <Pin />
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="absolute top-2 right-2 z-20 flex gap-2">
          <button
            onClick={() => onEdit(p)}
            disabled={uploading}
            className="px-2 py-1 bg-blue-600 text-white text-md rounded shadow disabled:opacity-50"
          >
            編集
          </button>
          <button
            onClick={() => onRemove(p)}
            disabled={uploading}
            className="px-2 py-1 bg-red-600 text-white text-md rounded shadow disabled:opacity-50"
          >
            削除
          </button>
        </div>
      )}

      {!isLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/10">
          <svg
            className="w-8 h-8 animate-spin text-pink-600"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        </div>
      )}

      {p.mediaType === "image" ? (
        <div className="relative w-full aspect-[1/1] sm:aspect-square overflow-hidden rounded-t-md">
          <Image
            src={p.mediaURL}
            alt={locTitle || p.title}
            fill
            className="object-cover"
            sizes="(min-width:1024px) 320px, (min-width:640px) 45vw, 90vw"
            onLoad={onMediaLoad}
            unoptimized
          />
        </div>
      ) : (
        <div className="relative w-full aspect-[1/1] sm:aspect-square overflow-hidden rounded-t-md">
          <video
            src={p.mediaURL}
            muted
            playsInline
            autoPlay
            loop
            preload="auto"
            className="w-full h-full object-cover absolute top-0 left-0"
            onLoadedData={onMediaLoad}
          />
        </div>
      )}

      <div className="p-3 space-y-2">
        <h2
          className={clsx(
            "text-sm font-bold whitespace-pre-wrap",
            "text-white text-outline"
          )}
        >
          {locTitle}
        </h2>
        {locBody && (
          <p
            className={clsx(
              "text-sm whitespace-pre-wrap",
              "text-white text-outline"
            )}
          >
            {locBody}
          </p>
        )}
      </div>
    </motion.div>
  );
}
