import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  deleteDoc,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import MenuItemCard from "./MenuItemCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function MenuSectionCard({
  section,
  onTitleUpdate,
  isLoggedIn,
}: {
  section: any;
  onTitleUpdate: (newTitle: string) => void;
  isLoggedIn: boolean;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState(section.title);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [isTaxIncluded, setIsTaxIncluded] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      const q = query(
        collection(db, `menuSections/${section.id}/items`),
        orderBy("order", "asc")
      );
      const snap = await getDocs(q);
      setItems(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchItems();
  }, [section.id]);

  const handleDelete = async () => {
    if (confirm("このセクションを削除しますか？")) {
      await deleteDoc(doc(db, "menuSections", section.id));
    }
  };

  const handleUpdate = async () => {
    if (!newTitle.trim()) {
      alert("セクション名を入力してください");
      return;
    }

    const trimmed = newTitle.trim();
    await updateDoc(doc(db, "menuSections", section.id), {
      title: trimmed,
    });

    onTitleUpdate(trimmed);
    setShowEditModal(false);
  };

  const handleAddItem = async () => {
    if (!newName.trim() || !newPrice.trim()) {
      alert("名前と価格は必須です");
      return;
    }

    const order = items.length;

    await addDoc(collection(db, `menuSections/${section.id}/items`), {
      name: newName.trim(),
      description: newDescription.trim(),
      price: Number(newPrice),
      isTaxIncluded,
      order,
    });

    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36),
        name: newName.trim(),
        description: newDescription.trim(),
        price: Number(newPrice),
        isTaxIncluded,
        order,
      },
    ]);

    setShowAddModal(false);
    setNewName("");
    setNewDescription("");
    setNewPrice("");
    setIsTaxIncluded(true);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("このメニューを削除しますか？")) return;

    await deleteDoc(doc(db, `menuSections/${section.id}/items`, itemId));

    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  return (
    <div className="bg-white/30 backdrop-blur-sm shadow-md p-4 rounded mb-6 ">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold">{section.title}</h2>
        {isLoggedIn && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEditModal(true)}
            >
              ✎ 編集
            </Button>
            <Button size="sm" variant="destructive" onClick={handleDelete}>
              削除
            </Button>
          </div>
        )}
      </div>

      {items.map((item) => (
        <MenuItemCard
          key={item.id}
          item={item}
          isLoggedIn={isLoggedIn}
          onDelete={() => handleDeleteItem(item.id)}
        />
      ))}

      {isLoggedIn && (
        <Button
          size="sm"
          className="mt-2"
          onClick={() => setShowAddModal(true)}
        >
          ＋ メニュー追加
        </Button>
      )}

      {/* 編集モーダル */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">セクション名を編集</h2>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mb-4"
            />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                キャンセル
              </Button>
              <Button onClick={handleUpdate}>保存</Button>
            </div>
          </div>
        </div>
      )}

      {/* メニュー追加モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">メニューを追加</h2>
            <Input
              placeholder="名前（例：ジェルネイル）"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mb-2"
            />
            <Input
              placeholder="説明（任意）"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="mb-2"
            />
            <Input
              placeholder="価格（例：5500）"
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="mb-2"
            />

            <div className="flex gap-4 mb-4 text-sm">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={isTaxIncluded}
                  onChange={() => setIsTaxIncluded(true)}
                />
                税込
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={!isTaxIncluded}
                  onChange={() => setIsTaxIncluded(false)}
                />
                税別
              </label>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                キャンセル
              </Button>
              <Button onClick={handleAddItem}>追加</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
