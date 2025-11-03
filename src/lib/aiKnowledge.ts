// src/lib/aiKnowledge.ts
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

/* ===============================
   型定義
=============================== */
export type KnowledgeData = {
  question: string;
  answer: string;
  updatedAt?: any;
};

/* ===============================
   基本知識を取得
=============================== */
export async function getBaseKnowledge(): Promise<KnowledgeData[]> {
  const snap = await getDoc(doc(db, "aiKnowledge", "base"));
  return snap.exists() ? (snap.data().items || []) : [];
}

/* ===============================
   オーナー固有の知識を取得
=============================== */
export async function getOwnerKnowledge(siteKey: string): Promise<KnowledgeData[]> {
  const snap = await getDoc(doc(db, "aiKnowledge", siteKey, "docs", "owner"));
  return snap.exists() ? (snap.data().items || []) : [];
}

/* ===============================
   AIが学習した知識を取得
=============================== */
export async function getLearnedKnowledge(siteKey: string): Promise<KnowledgeData[]> {
  const snap = await getDoc(doc(db, "aiKnowledge", siteKey, "docs", "learned"));
  return snap.exists() ? (snap.data().items || []) : [];
}

/* ===============================
   新しい学習データを保存
   （オーナーが回答した内容を登録）
=============================== */
export async function saveLearnedKnowledge(siteKey: string, data: KnowledgeData) {
  const ref = doc(db, "aiKnowledge", siteKey, "docs", "learned");
  const snap = await getDoc(ref);

  const existing = snap.exists() ? snap.data().items || [] : [];
  const newData = [
    ...existing,
    { ...data, updatedAt: serverTimestamp() },
  ];

  await setDoc(ref, { items: newData }, { merge: true });
}

/* ===============================
   AIの学習リクエストをログ化
   （AIがわからなかった質問を記録して通知用に使用）
=============================== */
export async function logUnknownQuestion(siteKey: string, question: string) {
  await addDoc(collection(db, "aiUnknownQuestions"), {
    siteKey,
    question,
    createdAt: serverTimestamp(),
  });
}
