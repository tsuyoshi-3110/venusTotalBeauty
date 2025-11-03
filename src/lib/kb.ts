// src/lib/kb.ts
// 役割: KB（/aiKB/entries）からの最小RAG検索
// - ベクトル類似 + 簡易レキシカル（文字N-gram Jaccard）を合成
// - TopK のヒットを返す
// 依存: adminDb（Firebase Admin）, SITE_KEY, embedText（src/lib/ai）

import { adminDb } from "@/lib/firebase-admin";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { embedText } from "@/lib/ai";

/* ================== 型 ================== */
export type KBEntry = {
  id: string;
  q: string;
  a: string;
  intent?: string;
  synonyms?: string[];
  embedding?: number[]; // Firestore に保存済みのベクトル
  enabled?: boolean;
};

export type KBHit = KBEntry & {
  score: number; // 合成スコア（0〜1）
  scores: { vec: number; lex: number };
};

/* ================== Firestore ================== */
const entriesColPath = (siteKey: string) => `sites/${siteKey}/aiKB/root/entries`;

// fetchEntries の where はインデックス未作成だと落ちるのでフォールバックを追加
async function fetchEntries(siteKey: string): Promise<KBEntry[]> {
  const col = adminDb.collection(entriesColPath(siteKey));
  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await col.where("enabled", "!=", false).get(); // enabled が false でなければOK
  } catch {
    // インデックス未作成や権限で失敗したら全件取得→アプリ側でフィルタ
    snap = await col.get();
  }
  const list: KBEntry[] = [];
  snap.forEach((doc) => {
    const d = doc.data() as any;
    if (d?.enabled === false) return; // クライアント側フィルタ（フォールバック時）
    list.push({
      id: doc.id,
      q: String(d.q || ""),
      a: String(d.a || ""),
      intent: d.intent || "general",
      synonyms: Array.isArray(d.synonyms) ? d.synonyms.map((s: any) => String(s)) : [],
      embedding: Array.isArray(d.embedding) ? (d.embedding as number[]) : undefined,
      enabled: d.enabled !== false,
    });
  });
  return list;
}


/* ================== 文字処理（日本語向け簡易） ================== */
function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[\u3000\s]+/g, " ") // 全角スペース→半角
    .replace(/[\p{P}\p{S}]/gu, ""); // 記号除去（Unicode）
}

function ngrams(str: string, n = 2): string[] {
  const s = normalize(str).replace(/\s+/g, ""); // 日本語は空白が希薄なので空白除去
  if (!s) return [];
  const out: string[] = [];
  for (let i = 0; i <= s.length - n; i++) out.push(s.slice(i, i + n));
  return out.length ? out : [s];
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const uni = sa.size + sb.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

/* ================== ベクトル類似 ================== */
function cosineSim(a?: number[], b?: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/* ================== 検索本体 ================== */
export async function retrieveKB(params: {
  question: string;
  topK?: number; // 返す件数
  minScore?: number; // 合成スコアの最小閾値
  siteKey?: string; // 省略時は定数 SITE_KEY
  vecWeight?: number; // 既定 0.7
  lexWeight?: number; // 既定 0.3
}): Promise<KBHit[]> {
  const {
    question,
    topK = 5,
    minScore = 0.35,
    siteKey = SITE_KEY,
    vecWeight = 0.7,
    lexWeight = 0.3,
  } = params;

  // 1) KB取得
  const entries = await fetchEntries(siteKey);
  if (entries.length === 0) return [];

  // 2) 問い合わせ埋め込み
  const qVec = await embedText(question);
  const qNgrams = ngrams(question, 2);

  // 3) スコアリング
  const hits: KBHit[] = entries.map((e) => {
    const targetLex = `${e.q}\n${(e.synonyms || []).join(" ")}`;
    const lex = jaccard(qNgrams, ngrams(targetLex, 2));
    const vec = cosineSim(qVec, e.embedding);
    const score = vecWeight * vec + lexWeight * lex;
    return { ...e, score, scores: { vec, lex } } as KBHit;
  });

  // 4) ソート＆フィルタ
  hits.sort((a, b) => b.score - a.score);
  const filtered = hits.filter((h) => h.score >= minScore).slice(0, topK);
  return filtered;
}

/* ================== プロンプト用の短い根拠生成 ================== */
export function hitsToPassages(hits: KBHit[]): string[] {
  return hits.map((h, i) => `［KB#${i + 1} / intent:${h.intent ?? "general"} / score:${h.score.toFixed(2)}］\nQ: ${h.q}\nA: ${h.a}`);
}
