// components/blog/CategoryManager.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import clsx from "clsx";
import {
  loadCategories,
  saveCategories,
  uniqueKeyForLabel,
  type BlogCategory,
  DEFAULT_CATEGORIES,
} from "@/lib/blogCategories";

export default function CategoryManager() {
  const [items, setItems] = useState<BlogCategory[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 入力は「表示名（label）」のみ
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    if (!SITE_KEY) return;
    (async () => {
      setLoading(true);
      try {
        const cats = await loadCategories(SITE_KEY);
        setItems(cats);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const canAdd = useMemo(() => !!newLabel.trim(), [newLabel]);

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    const key = uniqueKeyForLabel(label, items);
    setItems((prev) => [...prev, { key, label }]);
    setNewLabel("");
  };

  const remove = (idx: number) => {
    const c = items[idx];
    if (!confirm(`「${c.label}」を削除しますか？（既存記事の categoryKey は手動で直してください）`)) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      const [row] = next.splice(idx, 1);
      next.splice(j, 0, row);
      return next;
    });
  };

  const save = async () => {
    if (!SITE_KEY) return;
    setSaving(true);
    try {
      await saveCategories(SITE_KEY, items);
      alert("保存しました。");
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm">読み込み中…</div>;

  return (
    <div className="space-y-4 bg-white/50 p-10 rounded-2xl">
      {/* 追加フォーム（key 入力なし） */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="表示名（例：ハウスクリーニング）"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
        />
        <Button onClick={add} disabled={!canAdd}>
          追加
        </Button>
      </div>

      {/* 一覧（key は読み取り専用表示のみ） */}
      <div className="rounded-xl border border-black/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black/5">
            <tr>
              <th className="text-left p-2 w-2/5">label（表示名）</th>
              <th className="text-left p-2 w-2/5">key（自動生成）</th>
              <th className="text-right p-2 w-1/5">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c, idx) => (
              <tr key={c.key} className={clsx(idx % 2 === 0 ? "bg-white/50" : "bg-white/30")}>
                <td className="p-2 align-middle">
                  <Input
                    value={c.label}
                    onChange={(e) =>
                      setItems((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], label: e.target.value };
                        return next;
                      })
                    }
                  />
                </td>
                <td className="p-2 align-middle">
                  <div className="text-xs text-gray-500 break-all">{c.key}</div>
                </td>
                <td className="p-2 align-middle">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => move(idx, -1)}>
                      ↑
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => move(idx, +1)}>
                      ↓
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => remove(idx)}>
                      削除
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td className="p-3 text-center text-gray-500" colSpan={3}>
                  まだカテゴリーがありません。上のフォームから追加してください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </Button>
      </div>
    </div>
  );
}
