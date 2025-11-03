// src/app/ai/keywords/page.tsx など：このページのフルコード
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // なければ shadcn の textarea を追加してください
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import clsx from "clsx";

type KeywordDoc = {
  items?: string[];
  updatedAt?: any;
};

export default function AIKeywordsPage() {
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const docRef = useMemo(
    () => doc(db, "aiKnowledge", SITE_KEY, "docs", "keywords"),
    []
  );

  // 認証
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setIsOwner(!!u));
    return () => unsub();
  }, []);

  // 1回読み取り（リアルタイム購読はしない）
  const loadOnce = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDoc(docRef);
      const data = (snap.data() as KeywordDoc) ?? {};
      setItems(Array.isArray(data.items) ? data.items.filter(Boolean) : []);
    } catch (e) {
      console.error("keywords load error:", e);
    } finally {
      setLoading(false);
    }
  }, [docRef]);

  useEffect(() => {
    // 初回ロード
    loadOnce();
  }, [loadOnce]);

  // 保存ヘルパ
  const persist = useCallback(
    async (next: string[]) => {
      setSaving(true);
      const uniq = Array.from(
        new Set(next.map((s) => s.trim()).filter((s) => s.length > 0))
      ).slice(0, 500); // 念のため上限
      try {
        await setDoc(
          docRef,
          { items: uniq, updatedAt: serverTimestamp() },
          { merge: true }
        );
        setItems(uniq);
      } catch (e) {
        console.error("keywords save error:", e);
      } finally {
        setSaving(false);
      }
    },
    [docRef]
  );

  const addOne = async () => {
    const v = input.trim();
    if (!v) return;
    await persist([...items, v]);
    setInput("");
  };

  const removeAt = async (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    await persist(next);
  };

  const importBulk = async () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((s) => s.replace(/^[\s*・\-●]+/, "").trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setBulkOpen(false);
      setBulkText("");
      return;
    }
    await persist([...items, ...lines]);
    setBulkOpen(false);
    setBulkText("");
  };

  if (!isOwner) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-lg p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">AI 学習キーワード</h1>
          <p className="text-gray-600">編集にはログインが必要です。</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10 flex justify-center">
      <Card className="w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">AI 学習キーワード</h1>
          <Button variant="outline" onClick={loadOnce} disabled={loading || saving}>
            {loading ? "更新中…" : "再読込"}
          </Button>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          箇条書きの“キーワード”を登録すると、AI の前提知識として参照されます。
          サービス名・機材・薬剤名・対応条件・NG事項・よくある質問の単語などを短く入れてください。
        </p>

        {/* 追加フォーム */}
        <div className="flex gap-2 mb-4">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="例）追い焚き配管／ミストカワック／養生は浴室扉側から"
            disabled={saving || loading}
          />
          <Button onClick={addOne} disabled={saving || loading || !input.trim()}>
            追加
          </Button>
        </div>

        {/* 一括入力 */}
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => setBulkOpen((v) => !v)}
            disabled={saving || loading}
          >
            {bulkOpen ? "一括入力を閉じる" : "一括入力（改行で複数）"}
          </Button>
          {bulkOpen && (
            <div className="mt-3 space-y-2">
              <Textarea
                rows={6}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"例：\n強アルカリ電解水\nカビ取り剤はゴムパッキン不可\n定期清掃は2週間間隔が最適"}
                disabled={saving || loading}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setBulkOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={importBulk} disabled={saving || loading}>
                  まとめて追加
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 一覧 */}
        <div
          className={clsx(
            "rounded border p-3 min-h-[64px] bg-white",
            (loading || items.length === 0) && "text-gray-500"
          )}
        >
          {loading && <p>読み込み中…</p>}
          {!loading && items.length === 0 && <p>まだキーワードはありません。</p>}

          {!loading && items.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {items.map((k, i) => (
                <li
                  key={`${k}-${i}`}
                  className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1"
                >
                  <span className="text-sm">{k}</span>
                  <button
                    type="button"
                    aria-label="削除"
                    className="text-gray-500 hover:text-red-600"
                    onClick={() => removeAt(i)}
                    disabled={saving}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="text-right mt-3 text-sm text-gray-500">
          {saving ? "保存中…" : "自動保存"}
        </div>
      </Card>
    </main>
  );
}
