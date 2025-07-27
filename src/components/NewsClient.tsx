"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { AlertCircle, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import CardSpinner from "./CardSpinner";
import { useThemeGradient } from "@/lib/useThemeGradient";

interface NewsItem {
  id: string;
  title: string;
  body: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string;
}

export default function NewsClient() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [uploading, setUploading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);

  // AI用
  const [showAIModal, setShowAIModal] = useState(false);
  const [keywords, setKeywords] = useState(["", "", ""]);
  const [loading, setLoading] = useState(false);
  const nonEmptyKeywords = keywords.filter((k) => k.trim() !== "");
  const gradient = useThemeGradient();

  const SITE_KEY = "venusTotalBeaty";

  const colRef = useMemo(
    () => collection(db, "siteNews", SITE_KEY, "items"),
    [SITE_KEY]
  );

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    const q = query(colRef, orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setItems(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<NewsItem, "id">),
        }))
      );
    });
  }, [colRef]);

  const openAdd = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setModalOpen(true);
  };

  const openEdit = (item: NewsItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setTitle("");
    setBody("");
    setAlertVisible(false);
    setKeywords(["", "", ""]);
  };

  const handleSubmit = useCallback(async () => {
    if (!user || !title.trim() || !body.trim()) {
      setAlertVisible(true);
      return;
    }

    setUploading(true);

    if (editingId) {
      await updateDoc(doc(colRef, editingId), {
        title,
        body,
        updatedAt: Timestamp.now(),
      });
    } else {
      await addDoc(colRef, {
        title,
        body,
        createdAt: Timestamp.now(),
        createdBy: user.uid,
      });
    }

    setUploading(false);
    closeModal();
  }, [editingId, title, body, user, colRef]);

  const handleDelete = useCallback(
    async (item: NewsItem) => {
      if (!user || !confirm("本当に削除しますか？")) return;
      await deleteDoc(doc(colRef, item.id));
      setItems((prevItems) =>
        prevItems.filter((prevItem) => prevItem.id !== item.id)
      );
      setAlertVisible(false);
    },
    [user, colRef]
  );

  if (!gradient) return <CardSpinner />;

  return (
    <div>
      <ul className="space-y-4 p-4">
        {items.length === 0 ? (
          <li className="text-center text-white/80 text-lg py-12">
            現在、お知らせはまだありません。
          </li>
        ) : (
          items.map((item) => (
            <li
              key={item.id}
              className="bg-white/50 p-10 rounded-lg shadow-2xs"
            >
              <h2 className="font-bold">{item.title}</h2>
              <p className="mt-2 whitespace-pre-wrap">{item.body}</p>

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
            </li>
          ))
        )}
      </ul>

      {user && (
        <button
          onClick={openAdd}
          aria-label="新規追加"
          disabled={uploading}
          className="fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg hover:bg-pink-700 active:scale-95 transition disabled:opacity-50"
        >
          <Plus size={28} />
        </button>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-xl font-bold text-center">
              {editingId ? "お知らせを編集" : "お知らせを追加"}
            </h3>
            <input
              className="w-full border px-3 py-2 rounded"
              placeholder="タイトル"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
            <textarea
              className="w-full border px-3 py-2 rounded h-40"
              placeholder="本文"
              value={body}
              onChange={(e) => setBody(e.currentTarget.value)}
            />
            <button
              onClick={() => setShowAIModal(true)}
              className="bg-purple-600 text-white w-full py-2 rounded"
            >
              AIで作成
            </button>

            {alertVisible && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle />
                <AlertTitle>入力エラー</AlertTitle>
                <AlertDescription>
                  タイトルと本文を両方入力してください。
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={handleSubmit}
                disabled={uploading}
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

      {/* AIモーダル */}
      {showAIModal && (
        <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-xl font-bold text-center">AIで本文を生成</h3>
            <label>・最低1個以上必要。</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {keywords.map((word, i) => (
                <input
                  key={i}
                  type="text"
                  className="border p-2 rounded"
                  placeholder={`キーワード${i + 1}`}
                  value={word}
                  onChange={(e) => {
                    const newKeywords = [...keywords];
                    newKeywords[i] = e.target.value;
                    setKeywords(newKeywords);
                  }}
                />
              ))}
            </div>

            <button
              disabled={
                !title.trim() || nonEmptyKeywords.length === 0 || loading
              }
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await fetch("/api/generate-news", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      title,
                      keywords: nonEmptyKeywords,
                    }),
                  });
                  const data = await res.json();
                  setBody(data.text);
                  setShowAIModal(false); // 成功したらモーダル閉じる
                } catch {
                  alert("AI生成に失敗しました");
                } finally {
                  setLoading(false);
                  setKeywords(["", "", ""]);
                }
              }}
              className="bg-indigo-600 text-white w-full py-2 rounded disabled:opacity-50"
            >
              {loading ? "生成中..." : "作成"}
            </button>

            <button
              onClick={() => setShowAIModal(false)}
              className="bg-gray-300 w-full py-2 rounded"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
