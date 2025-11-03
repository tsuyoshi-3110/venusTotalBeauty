// components/common/LangPickerFullscreen.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { LANGS, type LangKey } from "@/lib/langs";
import { useUILang, type UILang } from "@/lib/atoms/uiLangAtom";

const JA = { key: "ja", label: "日本語", emoji: "🇯🇵" } as const;
const PINNED: LangKey[] = ["ja", "en", "zh", "zh-TW", "ko", "fr", "es", "de"];

export default function LangPickerFullscreen({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { uiLang, setUiLang } = useUILang();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");

  // 一覧（日本語を先頭）
  const all = useMemo(() => [JA, ...LANGS], []);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (l) =>
        l.label.toLowerCase().includes(q) || l.key.toLowerCase().includes(q)
    );
  }, [query, all]);

  const recents = useMemo(() => {
    if (typeof window === "undefined") return [] as UILang[];
    try {
      return JSON.parse(
        localStorage.getItem("uiLangRecents") || "[]"
      ) as UILang[];
    } catch {
      return [];
    }
  }, []);

  const onPick = (k: UILang) => {
    setUiLang(k);
    try {
      const prev = JSON.parse(
        localStorage.getItem("uiLangRecents") || "[]"
      ) as UILang[];
      const next = [k, ...prev.filter((x) => x !== k)].slice(0, 6);
      localStorage.setItem("uiLangRecents", JSON.stringify(next));
    } catch {}
    onClose();
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000]">
      {/* 背景クリックで閉じる */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* 本体 */}
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          "absolute inset-0 bg-white h-[100dvh] flex flex-col",
          "pt-[max(12px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 px-4 flex items-center gap-3 border-b">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="閉じる"
          >
            <span className="block h-5 w-5">✕</span>
          </button>
          <div className="text-base font-semibold">言語を選択</div>
          <div className="ml-auto text-sm text-gray-500">/{uiLang}</div>
        </div>

        {/* Search */}
        <div className="px-4 py-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="言語名 / コードで検索（例: フランス語 / fr）"
            className="w-full rounded-lg border px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-600"
            inputMode="search"
          />
        </div>

        {/* Quick（最近 + ピン留め） */}
        <div className="px-4">
          <div className="flex flex-wrap gap-2">
            {[...new Set<LangKey>([...(recents as LangKey[]), ...PINNED])].map(
              (k) => {
                const l = all.find((x) => x.key === k);
                if (!l) return null;
                const active = uiLang === l.key;
                return (
                  <button
                    key={`quick-${l.key}`}
                    type="button"
                    onClick={() => onPick(l.key as UILang)}
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm",
                      active
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-900 hover:bg-black/5"
                    )}
                    style={{ minHeight: 44, touchAction: "manipulation" as any }}
                    aria-label={`${l.label}を選択`}
                  >
                    <span className="text-base">{l.emoji}</span>
                    <span className="font-medium">{l.key}</span>
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* リスト（残り全体をスクロール領域に） */}
        <div
          className="mt-3 border-t flex-1 min-h-0"
          // iOS 慣性・縦パン優先
        >
          <div
            className="h-full overflow-y-auto overscroll-contain"
            style={{
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
            }}
          >
            <ul className="divide-y">
              {filtered.map((l) => {
                const active = uiLang === l.key;
                return (
                  <li key={l.key}>
                    <button
                      type="button"
                      onClick={() => onPick(l.key as UILang)}
                      className={clsx(
                        "w-full px-4 py-3 text-left flex items-center gap-3",
                        "hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none",
                        active && "bg-indigo-50"
                      )}
                      style={{ minHeight: 52, touchAction: "pan-y" as any }}
                      aria-label={`${l.label}を選択`}
                    >
                      <span className="text-2xl">{l.emoji}</span>
                      <div className="min-w-0">
                        <div className="text-[15px] font-medium truncate">
                          {l.label}
                        </div>
                        <div className="text-xs text-gray-500">/{l.key}</div>
                      </div>
                      {active && (
                        <span className="ml-auto text-xs text-indigo-600 font-semibold">
                          現在
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-gray-500">
                  一致する言語が見つかりません
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
