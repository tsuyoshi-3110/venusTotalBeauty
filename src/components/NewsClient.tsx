// app/(wherever)/NewsClient.tsx
"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  startAfter,
  limit,
  Timestamp,
  QueryDocumentSnapshot,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTask,
} from "firebase/storage";
import { AlertCircle, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import CardSpinner from "./CardSpinner";
import MediaWithSpinner from "./MediaWithSpinner";
import Image from "next/image";
import { useThemeGradient } from "@/lib/useThemeGradient";
import { THEMES, type ThemeKey as ThemeKeyGrad } from "@/lib/themes";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { BusyOverlay } from "./BusyOverlay";
import { useUILang } from "@/lib/atoms/uiLangAtom";
import { LANGS, type LangKey } from "@/lib/langs";

/* ---------- 型 ---------- */
// Firestore 保存形式：原文（ja）＋ t[lang] に各言語翻訳を保持
interface NewsItem {
  id: string;

  // 原文（日本語）
  titleBase: string;
  bodyBase: string;

  // 翻訳辞書（ja は base を使う想定）
  t?: Partial<Record<LangKey, { title: string; body: string }>>;

  createdAt: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
}

// 旧データ互換用（title/body だけの古いドキュメントを吸収）
type LegacyNews = {
  title?: string;
  body?: string;
  titleBase?: string;
  bodyBase?: string;
  t?: NewsItem["t"];
  createdAt?: any;
  updatedAt?: Timestamp;
  createdBy?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  [k: string]: any;
};

/* ---------- 定数 ---------- */
const ALLOWED_IMG = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-m4v",
  "video/x-msvideo",
  "video/x-ms-wmv",
  "video/mpeg",
  "video/3gpp",
  "video/3gpp2",
];
const MAX_VIDEO_SEC = 30;
const STORAGE_PATH = `siteNews/${SITE_KEY}/items`;

const FIRST_LOAD = 20;
const PAGE_SIZE = 20;

const DARK_KEYS: ThemeKeyGrad[] = ["brandG", "brandH", "brandI"];

// 見出しの多言語マップ
const NEWS_T = {
  ja: "お知らせ",
  en: "News",
  zh: "新闻",
  "zh-TW": "最新消息",
  ko: "공지사항",
  fr: "Actualités",
  es: "Noticias",
  de: "Neuigkeiten",
  pt: "Novidades",
  it: "Novità",
  ru: "Новости",
  th: "ข่าวสาร",
  vi: "Tin tức",
  id: "Berita",
  hi: "समाचार",
  ar: "الأخبار",
} as const;

/* =========================================================
      コンポーネント本体
========================================================= */
export default function NewsClient() {
  const { uiLang } = useUILang();
  const gradient = useThemeGradient();
  const isDark = useMemo(
    () => !!gradient && DARK_KEYS.some((k) => THEMES[k] === gradient),
    [gradient]
  );

  const headingText = NEWS_T[(uiLang as keyof typeof NEWS_T) ?? "ja"] ?? NEWS_T.ja;

  /* ---------- state ---------- */
  const [items, setItems] = useState<NewsItem[]>([]);
  const [user, setUser] = useState<User | null>(null);

  /* モーダル入力（原文のみ） */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleBase, setTitleBase] = useState("");
  const [bodyBase, setBodyBase] = useState("");

  /* メディア入力 */
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);

  /* 進捗・アップロード／保存 */
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const uploadTaskRef = useRef<UploadTask | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false); // BusyOverlay 用

  /* ページネーション */
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const isFetchingMore = useRef(false);
  const loadedMoreRef = useRef(false);

  /* エラー表示 */
  const [alertVisible, setAlertVisible] = useState(false);

  /* AI 本文生成（原文向け） */
  const [showAIModal, setShowAIModal] = useState(false);
  const [keywords, setKeywords] = useState(["", "", ""]);
  const [aiLoading, setAiLoading] = useState(false);
  const nonEmptyKeywords = keywords.filter((k) => k.trim() !== "");

  /* ---------- Firestore 参照 ---------- */
  const colRef = useMemo(
    () => collection(db, "siteNews", SITE_KEY, "items"),
    []
  );

  /* ---------- アンマウント時のアップロードキャンセル ---------- */
  useEffect(() => {
    return () => {
      try {
        uploadTaskRef.current?.cancel();
      } catch {
        /* noop */
      }
    };
  }, []);

  /* ---------- 初期フェッチ & 認証 ---------- */
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // 1ページ目を onSnapshot で購読（Map マージで一意化）
  useEffect(() => {
    if (isFetchingMore.current) return;

    const firstQuery = query(
      colRef,
      orderBy("createdAt", "desc"),
      limit(FIRST_LOAD)
    );

    const unsub = onSnapshot(firstQuery, (snap) => {
      const firstPage: NewsItem[] = snap.docs.map((d) =>
        normalizeItem(d.id, d.data() as LegacyNews)
      );

      setItems((prev) => {
        const map = new Map<string, NewsItem>(prev.map((x) => [x.id, x]));
        firstPage.forEach((x) => map.set(x.id, x));
        return [...map.values()].sort(
          (a, b) =>
            (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
        );
      });

      if (!loadedMoreRef.current) {
        setLastDoc(snap.docs.at(-1) ?? null);
      }
      setHasMore(snap.size === FIRST_LOAD);
    });

    return () => unsub();
  }, [colRef]);

  // 2ページ目以降のフェッチ
  const fetchNextPage = useCallback(async () => {
    if (isFetchingMore.current || !hasMore || !lastDoc) return;
    isFetchingMore.current = true;
    loadedMoreRef.current = true;

    try {
      const nextQuery = query(
        colRef,
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(nextQuery);
      const nextPage: NewsItem[] = snap.docs.map((d) =>
        normalizeItem(d.id, d.data() as LegacyNews)
      );

      setItems((prev) => {
        const map = new Map<string, NewsItem>(prev.map((x) => [x.id, x]));
        nextPage.forEach((x) => map.set(x.id, x));
        return [...map.values()].sort(
          (a, b) =>
            (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
        );
      });

      setLastDoc(snap.docs.at(-1) ?? null);
      setHasMore(snap.size === PAGE_SIZE);
    } finally {
      isFetchingMore.current = false;
    }
  }, [colRef, lastDoc, hasMore]);

  /* ---------- 無限スクロール ---------- */
  useEffect(() => {
    const onScroll = () => {
      if (
        hasMore &&
        !uploading &&
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 150
      ) {
        fetchNextPage();
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [fetchNextPage, hasMore, uploading]);

  /* =====================================================
      メディア選択 & プレビュー
  ===================================================== */
  const handleSelectFile = (file: File) => {
    const isImage = ALLOWED_IMG.includes(file.type);
    const isVideo = ALLOWED_VIDEO.includes(file.type);

    if (!isImage && !isVideo) {
      alert("対応していない形式です");
      return;
    }

    if (isVideo) {
      const video = document.createElement("video");
      const blobURL = URL.createObjectURL(file);
      video.preload = "metadata";
      video.src = blobURL;
      video.onloadedmetadata = () => {
        if (video.duration > MAX_VIDEO_SEC) {
          alert("動画は30秒以内にしてください");
          URL.revokeObjectURL(blobURL);
          return;
        }
        setDraftFile(file);
        setPreviewURL(blobURL);
      };
      return;
    }

    const blobURL = URL.createObjectURL(file);
    setDraftFile(file);
    setPreviewURL(blobURL);
  };

  /* =====================================================
      追加 / 更新（原文入力 → ja以外へ並列翻訳 → 保存）
  ===================================================== */
  const openAdd = () => {
    setEditingId(null);
    setTitleBase("");
    setBodyBase("");
    setDraftFile(null);
    setPreviewURL(null);
    setModalOpen(true);
    setAlertVisible(false);
  };

  const openEdit = (n: NewsItem) => {
    setEditingId(n.id);
    setTitleBase(n.titleBase || "");
    setBodyBase(n.bodyBase || "");
    setDraftFile(null);
    setPreviewURL(null);
    setModalOpen(true);
    setAlertVisible(false);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setTitleBase("");
    setBodyBase("");
    if (previewURL) URL.revokeObjectURL(previewURL);
    setDraftFile(null);
    setPreviewURL(null);
    setAlertVisible(false);
    setKeywords(["", "", ""]);
  };

  // 一括翻訳（並列実行）
  const translateAll = useCallback(async (title: string, body: string) => {
    const targets = (LANGS.map((l) => l.key) as LangKey[]).filter(
      (k) => k !== "ja"
    );

    const requests = targets.map(async (lang) => {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "ja", target: lang, title, body }),
      });
      if (!res.ok) throw new Error("translate error");
      const data = (await res.json()) as { title?: string; body?: string };
      const tt = (data.title || "").trim() || title;
      const bb = (data.body || "").trim() || body;
      return { lang, title: tt, body: bb };
    });

    const settled = await Promise.allSettled(requests);
    const t: NewsItem["t"] = {};
    settled.forEach((r, i) => {
      const lang = targets[i]!;
      if (r.status === "fulfilled") {
        t[lang] = { title: r.value.title, body: r.value.body };
      } else {
        // 失敗時は原文でフォールバック
        t[lang] = { title, body };
      }
    });
    return t;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!user || !titleBase.trim() || !bodyBase.trim()) {
      setAlertVisible(true);
      return;
    }

    setSaving(true);
    setUploading(!!draftFile);

    try {
      // アップロードと翻訳を並列
      const mediaPromise = (async (): Promise<
        Pick<NewsItem, "mediaUrl" | "mediaType">
      > => {
        if (!draftFile) return {};
        const sRef = ref(
          getStorage(),
          `${STORAGE_PATH}/${Date.now()}_${draftFile.name}`
        );
        const task = uploadBytesResumable(sRef, draftFile);
        uploadTaskRef.current = task;
        setUploadPct(0);

        task.on("state_changed", (s) =>
          setUploadPct(Math.round((s.bytesTransferred / s.totalBytes) * 100))
        );

        const url = await new Promise<string>((res, rej) =>
          task.on("state_changed", undefined, rej, async () =>
            res(await getDownloadURL(task.snapshot.ref))
          )
        );

        uploadTaskRef.current = null;

        return {
          mediaUrl: url,
          mediaType: ALLOWED_VIDEO.includes(draftFile.type) ? "video" : "image",
        };
      })();

      const translatePromise = translateAll(titleBase, bodyBase);

      const [mediaPart, t] = await Promise.all([mediaPromise, translatePromise]);

      const baseFields = {
        titleBase: titleBase.trim(),
        bodyBase: bodyBase.trim(),
        t,
        ...(mediaPart as object),
      } satisfies Partial<NewsItem>;

      if (editingId) {
        await updateDoc(doc(colRef, editingId), {
          ...baseFields,
          updatedAt: Timestamp.now(),
        });
      } else {
        await addDoc(colRef, {
          ...baseFields,
          createdAt: Timestamp.now(),
          createdBy: user.uid,
        } as Omit<NewsItem, "id">);
      }

      // 成功時：リセット
      setModalOpen(false);
      setEditingId(null);
      setTitleBase("");
      setBodyBase("");
      if (previewURL) URL.revokeObjectURL(previewURL);
      setDraftFile(null);
      setPreviewURL(null);
      setAlertVisible(false);
      setKeywords(["", "", ""]);
    } catch (err) {
      console.error(err);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
      setUploading(false);
      setUploadPct(null);
      uploadTaskRef.current = null;
    }
  }, [
    titleBase,
    bodyBase,
    draftFile,
    editingId,
    user,
    colRef,
    previewURL,
    translateAll,
  ]);

  /* =====================================================
      削除
  ===================================================== */
  const handleDelete = useCallback(
    async (n: NewsItem) => {
      if (!user || !confirm("本当に削除しますか？")) return;

      await deleteDoc(doc(colRef, n.id));
      if (n.mediaUrl) {
        try {
          await deleteObject(ref(getStorage(), n.mediaUrl as any));
        } catch {
          /* noop */
        }
      }
      setItems((prev) => prev.filter((m) => m.id !== n.id));
    },
    [user, colRef]
  );

  /* =====================================================
      レンダリング
  ===================================================== */

  if (!gradient) return <CardSpinner />;

  return (
    <div className="relative">
      {/* ✅ 共通 BusyOverlay（進捗＆保存中） */}
      <BusyOverlay uploadingPercent={uploadPct} saving={saving || aiLoading} />

      {/* 見出し（多言語） */}
      <h1 className="text-3xl font-semibold text-white text-outline ">
        {headingText}
      </h1>

      {/* ===== 一覧 ===== */}
      <ul className="space-y-4 p-4">
        {items.length === 0 ? (
          <li className="p-6 rounded-lg shadow border bg-white/30 text-white text-outline">
            現在、お知らせはまだありません。
          </li>
        ) : (
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <NewsCard
                key={item.id}
                item={item}
                user={user}
                openEdit={openEdit}
                handleDelete={handleDelete}
                isDark={isDark}
                uiLang={uiLang}
              />
            ))}
          </AnimatePresence>
        )}
      </ul>

      {/* ===== FAB ===== */}
      {user && (
        <button
          onClick={openAdd}
          aria-label="新規追加"
          disabled={saving}
          className="fixed bottom-6 z-50 right-6 w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg hover:bg-pink-700 active:scale-95 transition disabled:opacity-50"
        >
          <Plus size={28} />
        </button>
      )}

      {/* ===== 追加 / 編集モーダル（原文のみ入力） ===== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify中心 bg-black/50 overflow-y-auto">
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md space-y-4 my-8
                max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold text-center">
              {editingId ? "お知らせを編集（原文）" : "お知らせを追加（原文）"}
            </h3>

            {/* ---------- 入力欄（日本語の原文） ---------- */}
            <input
              className="w-full border px-3 py-2 rounded"
              placeholder="タイトル（日本語）"
              value={titleBase}
              onChange={(e) => setTitleBase(e.target.value)}
            />
            <textarea
              className="w-full border px-3 py-2 rounded h-40"
              placeholder="本文（日本語）"
              value={bodyBase}
              onChange={(e) => setBodyBase(e.target.value)}
            />

            {/* ---------- メディア選択 ---------- */}
            <div className="space-y-1">
              <label className="font-medium">画像 / 動画 (30秒以内)</label>

              {previewURL && (
                <p className="text-xs text-gray-600 truncate">
                  選択中: {draftFile?.name}
                </p>
              )}

              <input
                type="file"
                accept={[...ALLOWED_IMG, ...ALLOWED_VIDEO].join(",")}
                onChange={(e) =>
                  e.target.files?.[0] && handleSelectFile(e.target.files[0])
                }
              />

              {previewURL &&
                (draftFile && ALLOWED_VIDEO.includes(draftFile.type) ? (
                  <video
                    src={previewURL}
                    className="w-full mt-2 rounded"
                    controls
                  />
                ) : (
                  <div className="relative w-full mt-2 rounded overflow-hidden">
                    <Image
                      src={previewURL}
                      alt="preview"
                      fill
                      sizes="100vw"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ))}
            </div>

            {/* ---------- AI 生成ボタン（原文の下書き作成） ---------- */}
            <button
              onClick={() => {
                if (!titleBase.trim()) {
                  alert("タイトル（日本語）を入力してください。");
                  return;
                }
                setShowAIModal(true);
              }}
              className="bg-purple-600 text-white w-full py-2 rounded"
            >
              AIで本文を作成（日本語）
            </button>

            {/* ---------- バリデーションエラー ---------- */}
            {alertVisible && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>入力エラー</AlertTitle>
                <AlertDescription>
                  タイトルと本文（日本語）を入力してください。
                </AlertDescription>
              </Alert>
            )}

            {/* ---------- 送信 / キャンセル ---------- */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
              >
                {editingId ? "更新" : "追加"}
              </button>
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== AI モーダル（原文ジェネレータ） ===== */}
      {showAIModal && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold text-center">
              AIで本文を生成（日本語）
            </h3>

            <p className="text-sm text-gray-600">最低 1 つ以上入力</p>
            <div className="flex flex-col gap-2">
              {keywords.map((w, i) => (
                <input
                  key={i}
                  type="text"
                  className="border rounded px-2 py-1"
                  placeholder={`キーワード${i + 1}`}
                  value={w}
                  onChange={(e) => {
                    const next = [...keywords];
                    next[i] = e.target.value;
                    setKeywords(next);
                  }}
                />
              ))}
            </div>

            {nonEmptyKeywords.length > 0 && (
              <p className="text-xs text-gray-500">
                送信キーワード：
                <span className="font-medium">
                  {nonEmptyKeywords.join(" / ")}
                </span>
              </p>
            )}

            <button
              disabled={
                !titleBase.trim() || nonEmptyKeywords.length === 0 || aiLoading
              }
              onClick={async () => {
                setAiLoading(true);
                try {
                  const res = await fetch("/api/generate-news", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      title: titleBase,
                      keywords: nonEmptyKeywords,
                    }),
                  });
                  const data = await res.json();
                  setBodyBase(String(data.text ?? ""));
                  setShowAIModal(false);
                } catch {
                  alert("AI 生成に失敗しました");
                } finally {
                  setAiLoading(false);
                  setKeywords(["", "", ""]);
                }
              }}
              className="w-full py-2 rounded text-white bg-indigo-600 disabled:opacity-50"
            >
              {aiLoading ? "生成中…" : "本文を作成"}
            </button>

            <button
              onClick={() => {
                setShowAIModal(false);
                setKeywords(["", "", ""]);
              }}
              className="w-full py-2 rounded bg-gray-300"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== 正規化：旧データも新フォーマットで扱えるように変換 ===== */
function normalizeItem(id: string, raw: LegacyNews): NewsItem {
  const titleBase =
    typeof raw.titleBase === "string"
      ? raw.titleBase
      : typeof raw.title === "string"
      ? raw.title
      : "";
  const bodyBase =
    typeof raw.bodyBase === "string"
      ? raw.bodyBase
      : typeof raw.body === "string"
      ? raw.body
      : "";

  let createdAt: Timestamp;
  if (raw.createdAt instanceof Timestamp) {
    createdAt = raw.createdAt;
  } else if (raw.createdAt && typeof raw.createdAt.toMillis === "function") {
    createdAt = Timestamp.fromMillis(raw.createdAt.toMillis());
  } else {
    createdAt = Timestamp.fromMillis(Date.now());
  }

  const item: NewsItem = {
    id,
    titleBase,
    bodyBase,
    t: raw.t ?? undefined,
    createdAt,
    updatedAt: raw.updatedAt,
    createdBy: raw.createdBy ?? "",
    mediaUrl: raw.mediaUrl,
    mediaType: raw.mediaType,
  };

  return item;
}

/* ===== カード用サブコンポーネント ===== */
function NewsCard({
  item,
  user,
  openEdit,
  handleDelete,
  uiLang,
}: {
  item: NewsItem;
  user: User | null;
  openEdit: (n: NewsItem) => void;
  handleDelete: (n: NewsItem) => void;
  isDark: boolean;
  uiLang: LangKey;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -150px 0px" });

  // 表示用テキスト（言語フォールバック：uiLang → ja → en）
  const { titleText, bodyText } = useMemo(() => {
    if (uiLang === "ja") {
      return { titleText: item.titleBase, bodyText: item.bodyBase };
    }
    const t = item.t?.[uiLang];
    if (t?.title || t?.body) {
      return {
        titleText: t.title || item.titleBase,
        bodyText: t.body || item.bodyBase,
      };
    }
    if (item.titleBase || item.bodyBase) {
      return { titleText: item.titleBase, bodyText: item.bodyBase };
    }
    const en = item.t?.en;
    if (en) return { titleText: en.title || "", bodyText: en.body || "" };
    return { titleText: "", bodyText: "" };
  }, [item, uiLang]);

  return (
    <motion.li
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      exit={{ opacity: 0, y: 40 }}
      className={`p-6 rounded-lg shadow border bg-white/30`}
    >
      <h2 className="font-bold whitespace-pre-wrap text-white text-outline">
        {titleText}
      </h2>

      {/* メディア（画像 / 動画） */}
      {item.mediaUrl && (
        <MediaWithSpinner
          src={item.mediaUrl}
          type={item.mediaType!}
          className={
            item.mediaType === "image"
              ? "w-full max-h-80 object-cover mt-3 rounded"
              : "w-full mt-3 rounded"
          }
          autoPlay={item.mediaType === "video"}
          loop={item.mediaType === "video"}
          muted={item.mediaType === "video"}
        />
      )}

      <p className="mt-2 whitespace-pre-wrap  text-white text-outline">
        {bodyText}
      </p>

      {/* 編集・削除ボタン（ログイン時のみ） */}
      {user && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => openEdit(item)}
            className="px-3 py-1 bg-blue-600 text-white rounded"
          >
            編集
          </button>
          <button
            onClick={() => handleDelete(item)}
            className="px-3 py-1 bg-red-600 text-white rounded"
          >
            削除
          </button>
        </div>
      )}
    </motion.li>
  );
}
