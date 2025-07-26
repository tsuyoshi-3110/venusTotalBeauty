"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  addDoc,
} from "firebase/firestore";
import MenuSectionCard from "@/components/MenuSectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

const SITE_KEY = "venusTotalBeaty";

export default function MenuPage() {
  const [sections, setSections] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user); // ログインしていれば true、していなければ false
    });
    return () => unsub();
  }, []);

  const fetchSections = async () => {
    const q = query(
      collection(db, "menuSections"),
      where("siteKey", "==", SITE_KEY),
      orderBy("order", "asc")
    );
    const snap = await getDocs(q);
    setSections(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const handleAddSection = async () => {
    if (!newTitle.trim()) {
      alert("セクション名を入力してください");
      return;
    }

    const newOrder = sections.length;

    await addDoc(collection(db, "menuSections"), {
      title: newTitle,
      order: newOrder,
      siteKey: SITE_KEY,
    });

    setNewTitle("");
    setShowModal(false);
    await fetchSections(); // 再読み込み
  };

  return (
    <div className="p-4 max-w-2xl mx-auto pt-20">
      <h1 className="text-2xl font-bold mb-4 text-white">menu</h1>

      {/* セクション追加ボタン */}
      {isLoggedIn && (
        <Button className="mb-6" onClick={() => setShowModal(true)}>
          ＋ セクションを追加
        </Button>
      )}

      {/* 各セクション表示 */}
      {sections.map((section) => (
        <MenuSectionCard
          key={section.id}
          section={section}
          isLoggedIn={isLoggedIn}
          onTitleUpdate={(newTitle) => {
            setSections((prev) =>
              prev.map((s) =>
                s.id === section.id ? { ...s, title: newTitle } : s
              )
            );
          }}
        />
      ))}

      {/* 追加モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">新しいセクションを追加</h2>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="例：ネイル、ヘアカット"
              className="mb-4"
            />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                キャンセル
              </Button>
              <Button onClick={handleAddSection}>追加</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
