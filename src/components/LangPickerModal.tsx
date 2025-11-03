"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { LANGS, LangKey } from "@/lib/langs";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (langKey: LangKey) => void;
  busy?: boolean; // 翻訳中インジケータ
};

export default function LangPickerModal({
  open,
  onClose,
  onSelect,
  busy = false,
}: Props) {
  const [langQuery, setLangQuery] = useState("");

  const filtered = useMemo(() => {
    const q = langQuery.trim().toLowerCase();
    if (!q) return LANGS;
    return LANGS.filter(
      (l) =>
        l.label.toLowerCase().includes(q) || l.key.toLowerCase().includes(q)
    );
  }, [langQuery]);

  if (!open) return null;

  const handleBackdrop = () => {
    if (!busy) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40"
      onClick={handleBackdrop}
      aria-modal="true"
      role="dialog"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-lg mx-4 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-2xl bg-white/90 backdrop-saturate-150 border border-white/50">
          {/* ヘッダー */}
          <div className="p-5 border-b border-black/5 flex items-center justify-between">
            <h3 className="text-lg font-bold">言語を選択</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-800 disabled:opacity-60"
              disabled={busy}
            >
              閉じる
            </button>
          </div>

          {/* 検索 */}
          <div className="px-5 pt-4">
            <input
              type="text"
              value={langQuery}
              onChange={(e) => setLangQuery(e.target.value)}
              placeholder="言語名やコードで検索（例: フランス語 / fr）"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="言語検索"
            />
          </div>

          {/* 言語グリッド */}
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map((lng) => (
              <button
                key={lng.key}
                type="button"
                onClick={() => onSelect(lng.key)}
                disabled={busy}
                className={clsx(
                  "group relative rounded-xl border p-3 text-left transition",
                  "bg-white hover:shadow-lg hover:-translate-y-0.5",
                  "focus:outline-none focus:ring-2 focus:ring-indigo-500",
                  "disabled:opacity-60"
                )}
                aria-label={`${lng.label}を選択`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{lng.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{lng.label}</div>
                    <div className="text-xs text-gray-500">/{lng.key}</div>
                  </div>
                </div>
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-indigo-400 opacity-0 group-hover:opacity-100 transition" />
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center text-sm text-gray-500 py-6">
                一致する言語が見つかりません
              </div>
            )}
          </div>

          {/* フッター */}
          <div className="px-5 pb-5">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-60"
              disabled={busy}
            >
              キャンセル
            </button>
          </div>

          {/* 進捗バー */}
          {busy && (
            <div className="h-1 w-full overflow-hidden rounded-b-2xl">
              <div className="h-full w-1/2 animate-[progress_1.2s_ease-in-out_infinite] bg-indigo-500" />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
