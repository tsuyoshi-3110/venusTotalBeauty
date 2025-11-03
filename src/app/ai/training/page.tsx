// src/app/ai/training/page.tsx
"use client";

import { useEffect, useState } from "react";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

type PendingItem = {
  id: string;
  question: string;
  sentAt: string | null;
  ownerEmail?: string | null;
};

export default function AITrainingPage() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai-unknown/list?siteKey=${SITE_KEY}`);
      const data = await res.json();
      if (data.ok) setItems(data.items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const handleChange = (id: string, v: string) => {
    setAnswers((prev) => ({ ...prev, [id]: v }));
  };

  const handleSave = async (item: PendingItem) => {
    const answer = answers[item.id];
    if (!answer?.trim()) return alert("回答を入力してください。");

    setSavingId(item.id);
    try {
      const res = await fetch("/api/ai-knowledge/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteKey: SITE_KEY,
          question: item.question,
          answer,
          notificationId: item.id,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "save failed");

      // 保存成功 → 画面から除外
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      setAnswers((prev) => {
        const nxt = { ...prev };
        delete nxt[item.id];
        return nxt;
      });
    } catch (e: any) {
      console.error(e);
      alert(`保存に失敗しました：${e.message}`);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 rounded-2xl bg-white/50 mt-10">
      <h1 className="text-2xl font-bold mb-3">AI学習（未回答の質問）</h1>
      <p className="text-sm text-gray-600 mb-6">
        サイトID：<span className="font-mono">{SITE_KEY}</span>
      </p>

      {loading ? (
        <div className="text-gray-600">読み込み中…</div>
      ) : items.length === 0 ? (
        <div className="text-gray-600">未対応の質問はありません。</div>
      ) : (
        <div className="space-y-6">
          {items.map((item) => (
            <div key={item.id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="text-sm text-gray-500 mb-1">
                受信: {item.sentAt ? new Date(item.sentAt).toLocaleString() : "-"}
              </div>
              <div className="font-semibold mb-2">質問</div>
              <div className="p-3 bg-gray-50 rounded border mb-4 whitespace-pre-wrap">
                {item.question}
              </div>

              <label className="block text-sm font-semibold mb-2">回答（AIの学習に保存されます）</label>
              <textarea
                className="w-full min-h-[120px] border rounded p-3 mb-3"
                placeholder="ここに回答を入力…（次回からAIが自動で返します）"
                value={answers[item.id] ?? ""}
                onChange={(e) => handleChange(item.id, e.target.value)}
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleSave(item)}
                  disabled={savingId === item.id}
                  className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
                >
                  {savingId === item.id ? "保存中…" : "AIに学習させて保存"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
