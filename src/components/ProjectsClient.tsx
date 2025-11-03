"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Plus, Pin } from "lucide-react";
import { v4 as uuid } from "uuid";
import imageCompression from "browser-image-compression";
import { motion } from "framer-motion";

// UI
import { BusyOverlay } from "./BusyOverlay";
import ProductMedia from "./ProductMedia";

// Firebase
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  writeBatch,
  orderBy,
  query,
  serverTimestamp,
  CollectionReference,
  DocumentData,
  limit,
  startAfter,
  getDocs,
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

// Theme
import { useThemeGradient } from "@/lib/useThemeGradient";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

// DnD
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Lang
import { LANGS, type LangKey } from "@/lib/langs";
import { useUILang, type UILang } from "@/lib/atoms/uiLangAtom";

// ファイル形式ヘルパ
import {
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
  extFromMime,
} from "@/lib/fileTypes";
import { ThemeKey, THEMES } from "@/lib/themes";

/* ===================== 型 ===================== */
type MediaType = "image" | "video";

type Base = { title: string; body: string };
type Tr = { lang: LangKey; title?: string; body?: string };

type StorePick = { id: string; title: string; placeId?: string };

type ProductDoc = {
  id: string;
  base: Base;
  t: Tr[];
  title?: string;
  body?: string;
  mediaURL: string;
  mediaType: MediaType;
  price: number;
  order?: number;
  originalFileName?: string;
  createdAt?: any;
  updatedAt?: any;
  // 🔗 施工実績 ⇔ 店舗 の紐づけ
  storeLink?: {
    storeId: string;
    placeId?: string;
  };
};

/* ===== ページ見出し（施工実績） ===== */
const PAGE_TITLE_T: Record<UILang, string> = {
  ja: "施工実績",
  en: "Projects",
  zh: "项目案例",
  "zh-TW": "施工實績",
  ko: "시공 실적",
  fr: "Réalisations",
  es: "Proyectos",
  de: "Projekte",
  pt: "Projetos",
  it: "Progetti",
  ru: "Проекты",
  th: "ผลงาน",
  vi: "Dự án",
  id: "Proyek",
  hi: "परियोजनाएँ",
  ar: "المشاريع",
};

/* ===================== 定数 ===================== */
const COL_PATH = `siteProjects/${SITE_KEY}/items`;
const MAX_VIDEO_SEC = 60;

/* ===================== ユーティリティ ===================== */
function displayOf(p: ProductDoc, lang: UILang): Base {
  if (lang === "ja") return p.base;
  const hit = p.t?.find((x) => x.lang === lang);
  return {
    title: (hit?.title ?? p.base.title) || "",
    body: (hit?.body ?? p.base.body) || "",
  };
}

async function translateAll(titleJa: string, bodyJa: string): Promise<Tr[]> {
  const tasks = LANGS.map(async (l) => {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleJa, body: bodyJa, target: l.key }),
    });
    if (!res.ok) throw new Error(`translate failed: ${l.key}`);
    const data = (await res.json()) as { title?: string; body?: string };
    return {
      lang: l.key,
      title: (data.title ?? "").trim(),
      body: (data.body ?? "").trim(),
    };
  });
  return Promise.all(tasks);
}

function mapsUrlFromPlaceId(placeId: string) {
  return `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(
    placeId
  )}`;
}

/* ===================== DnDアイテム ===================== */
function SortableItem({
  product,
  children,
}: {
  product: ProductDoc;
  children: (args: {
    attributes: any;
    listeners: any;
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

/* ===================== 本体 ===================== */
export default function ProjectsClient() {
  const router = useRouter();

  // 一覧・権限
  const [list, setList] = useState<ProductDoc[]>([]);
  const [listLoaded, setListLoaded] = useState(false); // 👈 追加：初回購読完了フラグ
  const [isAdmin, setIsAdmin] = useState(false);

  // 言語
  const { uiLang } = useUILang();

  // フォーム状態
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<ProductDoc | null>(null);
  const [titleJa, setTitleJa] = useState("");
  const [bodyJa, setBodyJa] = useState("");

  // メディア
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // AI 本文生成
  const [showBodyGen, setShowBodyGen] = useState(false);
  const [aiKeywords, setAiKeywords] = useState<string[]>(["", "", ""]);
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const canOpenBodyGen = Boolean(titleJa?.trim());
  const canGenerateBody = aiKeywords.some((k) => k.trim());

  // ページング
  const [lastVisible, setLastVisible] = useState<DocumentData | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // 店舗選択
  const [storeOptions, setStoreOptions] = useState<StorePick[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");

  const pageTitle = PAGE_TITLE_T[uiLang] ?? PAGE_TITLE_T.ja;

  // テーマ
  const gradient = useThemeGradient();

  const isDark = useMemo(() => {
    const darkKeys: ThemeKey[] = ["brandG", "brandH", "brandI"];
    return gradient && darkKeys.some((k) => gradient === THEMES[k]);
  }, [gradient]);

  // Firestore 参照
  const colRef: CollectionReference<DocumentData> = useMemo(
    () => collection(db, COL_PATH),
    []
  );

  /* -------- 権限 -------- */
  useEffect(() => onAuthStateChanged(auth, (u) => setIsAdmin(!!u)), []);

  /* -------- 店舗一覧（名前＋placeId） -------- */
  useEffect(() => {
    const ref = collection(db, `siteStores/${SITE_KEY}/items`);
    const unsub = onSnapshot(ref, (snap) => {
      const rows: StorePick[] = snap.docs.map((d) => {
        const v = d.data() as any;
        return {
          id: d.id,
          title: v?.base?.name || v?.name || "(無題の店舗)",
          placeId: v?.geo?.placeId,
        };
      });
      setStoreOptions(rows);
    });
    return () => unsub();
  }, []);

  /* -------- 初回20件 購読 -------- */
  useEffect(() => {
    const q = query(colRef, orderBy("order", "asc"), limit(20));
    const unsubscribe = onSnapshot(q, (snap) => {
      const firstPage = snap.docs.map((d) => {
        const data = d.data() as any;
        const base: Base = data.base ?? {
          title: data.title ?? "",
          body: data.body ?? "",
        };
        const t: Tr[] = Array.isArray(data.t) ? data.t : [];
        const row: ProductDoc = {
          id: d.id,
          base,
          t,
          title: data.title,
          body: data.body,
          mediaURL: data.mediaURL ?? "",
          mediaType: (data.mediaType as MediaType) ?? "image",
          price: typeof data.price === "number" ? data.price : 0,
          order: data.order ?? 9999,
          originalFileName: data.originalFileName,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          storeLink: data.storeLink,
        };
        return row;
      });

      setList((prev) => {
        const firstIds = new Set(firstPage.map((r) => r.id));
        const others = prev.filter((r) => !firstIds.has(r.id));
        const merged = [...firstPage, ...others];
        merged.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
        return merged;
      });

      setLastVisible(snap.docs.at(-1) ?? null);
      setHasMore(snap.docs.length === 20);
      setListLoaded(true); // 👈 最初のスナップショット受信
    });

    return () => unsubscribe();
  }, [colRef]);

  /* -------- 次ページ読込 -------- */
  const loadMore = useCallback(async () => {
    if (!lastVisible || loadingMore || !hasMore) return;

    setLoadingMore(true);
    const q = query(
      colRef,
      orderBy("order", "asc"),
      startAfter(lastVisible),
      limit(20)
    );
    const snap = await getDocs(q);

    const existingIds = new Set(list.map((x) => x.id));
    const nextPage = snap.docs
      .map((d) => {
        const data = d.data() as any;
        const base: Base = data.base ?? {
          title: data.title ?? "",
          body: data.body ?? "",
        };
        const t: Tr[] = Array.isArray(data.t) ? data.t : [];
        const row: ProductDoc = {
          id: d.id,
          base,
          t,
          title: data.title,
          body: data.body,
          mediaURL: data.mediaURL ?? "",
          mediaType: (data.mediaType as MediaType) ?? "image",
          price: typeof data.price === "number" ? data.price : 0,
          order: data.order ?? 9999,
          originalFileName: data.originalFileName,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          storeLink: data.storeLink,
        };
        return row;
      })
      .filter((row) => !existingIds.has(row.id));

    setList((prev) => {
      const merged = [...prev, ...nextPage];
      merged.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
      return merged;
    });

    setLastVisible(snap.docs.at(-1) ?? null);
    setHasMore(snap.docs.length === 20);
    setLoadingMore(false);
  }, [colRef, lastVisible, loadingMore, hasMore, list]);

  useEffect(() => {
    const onScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;
      if (nearBottom && !loadingMore && hasMore) {
        loadMore();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [loadMore, loadingMore, hasMore]);

  /* -------- DnD -------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = list.findIndex((x) => x.id === active.id);
      const newIndex = list.findIndex((x) => x.id === over.id);
      const next = arrayMove(list, oldIndex, newIndex);
      setList(next);

      const batch = writeBatch(db);
      next.forEach((p, i) => batch.update(doc(colRef, p.id), { order: i }));
      await batch.commit();
    },
    [list, colRef]
  );

  /* -------- ファイル選択（動画長さチェック） -------- */
  const onSelectFile = (f: File) => {
    if (!f) return;
    const isVideo = f.type.startsWith("video/");
    if (!isVideo) {
      setFile(f);
      return;
    }
    const blobUrl = URL.createObjectURL(f);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = blobUrl;
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(blobUrl);
      if (v.duration > MAX_VIDEO_SEC) {
        alert(`動画は ${MAX_VIDEO_SEC} 秒以内にしてください`);
        return;
      }
      setFile(f);
    };
  };

  /* -------- 保存 -------- */
  const saveProduct = useCallback(async () => {
    if (progress !== null || saving) return;
    if (!titleJa.trim()) return alert("タイトルは必須です");
    if (formMode === "add" && !file) return alert("メディアを選択してください");

    setSaving(true);
    try {
      const id = editing?.id ?? uuid();
      let mediaURL = editing?.mediaURL ?? "";
      let mediaType: MediaType = editing?.mediaType ?? "image";
      let originalFileName = editing?.originalFileName;

      // 画像/動画アップロード
      if (file) {
        const isVideo = file.type.startsWith("video/");
        mediaType = isVideo ? "video" : "image";

        const isValidVideo = VIDEO_MIME_TYPES.includes(file.type);
        const isValidImage = IMAGE_MIME_TYPES.includes(file.type);
        if (!isValidImage && !isValidVideo) {
          alert("対応形式ではありません");
          setSaving(false);
          return;
        }

        const ext = extFromMime(file.type);
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
          `projects/public/${SITE_KEY}/${id}.${ext}`
        );
        const task = uploadBytesResumable(sref, uploadFile, {
          contentType: isVideo ? file.type : "image/jpeg",
        });

        setProgress(0);
        await new Promise<void>((resolve, reject) => {
          task.on(
            "state_changed",
            (s) =>
              setProgress(
                Math.round((s.bytesTransferred / s.totalBytes) * 100)
              ),
            (e) => reject(e),
            () => resolve()
          );
        });

        const downloadURL = await getDownloadURL(sref);
        mediaURL = `${downloadURL}?v=${uuid()}`;
        originalFileName = file.name;
        setProgress(null);

        // 拡張子が変わった時は旧ファイル削除（拡張子推定）
        if (formMode === "edit" && editing) {
          const oldExt = extFromMime(
            editing.mediaType === "video" ? "video/mp4" : "image/jpeg"
          );
          if (oldExt !== ext) {
            await deleteObject(
              storageRef(
                getStorage(),
                `projects/public/${SITE_KEY}/${id}.${oldExt}`
              )
            ).catch(() => {});
          }
        }
      }

      // 翻訳
      const t = await translateAll(titleJa.trim(), bodyJa.trim());
      const base: Base = { title: titleJa.trim(), body: bodyJa.trim() };

      // 店舗リンク
      let storeLink: ProductDoc["storeLink"] | undefined;
      if (selectedStoreId) {
        const picked = storeOptions.find((o) => o.id === selectedStoreId);
        if (picked) storeLink = { storeId: picked.id, placeId: picked.placeId };
      }

      const payload: Partial<ProductDoc> = {
        base,
        t,
        title: base.title,
        body: base.body,
        mediaURL,
        mediaType,
        ...(originalFileName ? { originalFileName } : {}),
        ...(storeLink ? { storeLink } : {}),
        updatedAt: serverTimestamp() as any,
      };

      if (formMode === "edit" && editing) {
        await updateDoc(doc(colRef, id), payload as any);
      } else {
        const tail = (list.at(-1)?.order ?? list.length - 1) + 1;
        await addDoc(colRef, {
          ...payload,
          createdAt: serverTimestamp(),
          order: tail,
        } as any);
      }

      // リセット
      setFormMode(null);
      setEditing(null);
      setFile(null);
      setSelectedStoreId("");
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
      setProgress(null);
    } finally {
      setSaving(false);
    }
  }, [
    progress,
    saving,
    titleJa,
    bodyJa,
    formMode,
    file,
    editing,
    colRef,
    list,
    selectedStoreId,
    storeOptions,
  ]);

  if (!gradient) return null;

  /* ===================== JSX ===================== */
  return (
    <main className="max-w-5xl mx-auto p-4 pt-5">
      <BusyOverlay uploadingPercent={progress} saving={saving} />

      <h1
        className="text-3xl font-semibold text-white text-outline mb-10"
        aria-label={pageTitle}
      >
        {pageTitle}
      </h1>

      {/* 空状態（初回ロード後に件数0なら表示） */}
      {listLoaded && list.length === 0 ? (
        <p
          className={clsx(
            "text-sm",
            isDark ? "text-white/70" : "text-muted-foreground"
          )}
        >
          準備中...
        </p>
      ) : (
        /* 一覧 */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={list.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 lg:grid-cols-2 items-stretch">
              {list.map((p) => {
                const loc = displayOf(p, uiLang);
                const storeName = p.storeLink?.storeId
                  ? storeOptions.find((s) => s.id === p.storeLink!.storeId)
                      ?.title
                  : undefined;
                return (
                  <SortableItem key={p.id} product={p}>
                    {({ listeners, attributes, isDragging }) => (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.3 }}
                        onClick={() => router.push(`/projects/${p.id}`)}
                        className="relative cursor-pointer h-full"
                      >
                        {/* DnD ハンドル */}
                        {auth.currentUser && (
                          <div
                            {...attributes}
                            {...listeners}
                            onClick={(e) => e.stopPropagation()}
                            onContextMenu={(e) => e.preventDefault()}
                            draggable={false}
                            className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 z-30 cursor-grab active:cursor-grabbing select-none p-3 touch-none"
                            role="button"
                            aria-label="並び替え"
                          >
                            <div className="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center shadow pointer-events-none">
                              <Pin />
                            </div>
                          </div>
                        )}

                        <div
                          className={clsx(
                            "flex h-full flex-col border rounded-lg overflow-hidden shadow-xl transition-colors duration-200",
                            "bg-gradient-to-b",
                            gradient,
                            isDragging ? "bg-yellow-100" : "bg-white",
                            !isDragging && "hover:shadow-lg"
                          )}
                        >
                          {/* メディア */}
                          <ProductMedia
                            src={p.mediaURL}
                            type={p.mediaType}
                            alt={loc.title || "project"}
                            className="shadow-lg"
                          />

                          {/* 情報 */}
                          <div className="p-3 space-y-1">
                            <h2 className="text-white text-outline">
                              {loc.title || "（無題）"}
                            </h2>

                            {/* 店舗名＋Googleマップ */}
                            {p.storeLink?.placeId && (
                              <a
                                href={mapsUrlFromPlaceId(p.storeLink.placeId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-700 underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {storeName
                                  ? `${storeName} をGoogleマップで見る`
                                  : "Googleマップで見る"}
                              </a>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </SortableItem>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* 追加 FAB */}
      {isAdmin && !formMode && (
        <button
          onClick={() => {
            setEditing(null);
            setTitleJa("");
            setBodyJa("");
            setFile(null);
            setSelectedStoreId("");
            setFormMode("add");
          }}
          className="fixed z-50 bottom-6 right-6 w-14 h-14 bg-blue-500 text-white  rounded-full shadow-lg flex items-center justify-center"
        >
          <Plus size={28} />
        </button>
      )}

      {/* フォーム */}
      {isAdmin && formMode && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-white rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-center">
              {formMode === "edit" ? "編集" : "新規追加"}
            </h2>

            <input
              placeholder="タイトル"
              value={titleJa}
              onChange={(e) => setTitleJa(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            />

            <textarea
              placeholder="本文"
              value={bodyJa}
              onChange={(e) => setBodyJa(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              rows={6}
            />

            {/* AI 本文生成 */}
            <button
              type="button"
              onClick={() => setShowBodyGen(true)}
              className={clsx(
                "w-full px-4 py-2 rounded text-white",
                canOpenBodyGen ? "bg-indigo-600" : "bg-gray-400"
              )}
              disabled={!canOpenBodyGen || saving}
            >
              AIで本文生成
            </button>

            {/* 生成モーダル */}
            {showBodyGen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="w-full max-w-md bg-white rounded-lg p-6 space-y-4"
                >
                  <h3 className="text-lg font-bold">AIで本文生成</h3>
                  {aiKeywords.map((k, i) => (
                    <input
                      key={i}
                      value={k}
                      onChange={(e) => {
                        const next = [...aiKeywords];
                        next[i] = e.target.value;
                        setAiKeywords(next);
                      }}
                      placeholder={`キーワード${i + 1}`}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  ))}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowBodyGen(false)}
                      className="flex-1 bg-gray-200 py-2 rounded"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={async () => {
                        if (!titleJa.trim()) return;
                        try {
                          setAiGenLoading(true);
                          const keywords = aiKeywords.filter((k) => k.trim());
                          const res = await fetch("/api/generate-description", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ title: titleJa, keywords }),
                          });
                          const data = await res.json();
                          if (!res.ok)
                            throw new Error(data?.error || "生成に失敗");
                          const newBody = (data?.body ?? "").trim();
                          if (!newBody)
                            return alert("有効な本文が返りませんでした。");
                          setBodyJa(newBody);
                          setShowBodyGen(false);
                          setAiKeywords(["", "", ""]);
                        } catch {
                          alert("本文生成に失敗しました");
                        } finally {
                          setAiGenLoading(false);
                        }
                      }}
                      className={clsx(
                        "flex-1 py-2 rounded text-white",
                        canGenerateBody ? "bg-indigo-600" : "bg-gray-400"
                      )}
                      disabled={!canGenerateBody || aiGenLoading}
                    >
                      {aiGenLoading ? "生成中…" : "生成する"}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* メディア */}
            <input
              type="file"
              accept={[...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES].join(",")}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onSelectFile(f);
              }}
              className="bg-gray-500 text-white w-full h-10 px-3 py-1 rounded"
            />

            <div className="flex gap-2 justify-center">
              <button
                onClick={saveProduct}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                {saving ? "保存中…" : formMode === "edit" ? "更新" : "追加"}
              </button>
              <button
                onClick={() => setFormMode(null)}
                className="px-4 py-2 bg-gray-500 text-white rounded"
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
