// app/api/ai/kb/approve/route.ts
// 役割: KB提案 (/aiKB/suggestions) を「採用」し、/aiKB/entries へ昇格させるAPI
//       採用時に埋め込みベクトルを生成して保存（RAGで利用）
// 想定呼び出し元: 管理画面（オーナー/管理者のみ）
// 依存: adminDb（Firebase Admin）, SITE_KEY, embedText（src/lib/ai）

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { embedText } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================== 型 ================== */
type ApproveBody = {
  suggestionId: string;
  override?: {
    q?: string;
    a?: string;
    intent?: string;
    synonyms?: string[]; // 類義語/別表記（検索改善用）
    enabled?: boolean;   // 既定 true
  };
};

/* ================== Firestore paths ================== */
const kbSuggestionDocPath = (siteKey: string, sid: string) => `sites/${siteKey}/aiKB/root/suggestions/${sid}`;
const kbEntriesColPath = (siteKey: string) => `sites/${siteKey}/aiKB/root/entries`;

/* ================== Helpers ================== */
function clamp(s: any, max = 4000) {
  const t = String(s ?? "");
  return t.length > max ? t.slice(0, max) : t;
}

/* ================== Main ================== */
export async function POST(req: NextRequest) {
  try {
    const siteKey = SITE_KEY;
    const body = (await req.json()) as ApproveBody;

    if (!body?.suggestionId) {
      return NextResponse.json({ error: "suggestionId is required" }, { status: 400 });
    }

    // 1) 提案を取得
    const sugRef = adminDb.doc(kbSuggestionDocPath(siteKey, body.suggestionId));
    const sugSnap = await sugRef.get();
    if (!sugSnap.exists) {
      return NextResponse.json({ error: "suggestion not found" }, { status: 404 });
    }

    const sug = sugSnap.data() as any;
    const q = clamp(body.override?.q ?? sug.question ?? "").trim();
    const a = clamp(body.override?.a ?? sug.proposedAnswer ?? "").trim();
    const intent = (body.override?.intent ?? sug.intent ?? "general").trim();
    const synonyms = (body.override?.synonyms ?? []).map((s) => String(s).trim()).filter(Boolean);
    const enabled = body.override?.enabled ?? true;

    if (!q || !a) {
      return NextResponse.json({ error: "both question(q) and answer(a) are required" }, { status: 400 });
    }

    // 2) 埋め込み生成（QとAを結合して代表ベクトル化）
    const embedding = await embedText(`${q}\n${a}`);

    // 3) entries に追加
    const entriesRef = adminDb.collection(kbEntriesColPath(siteKey));
    const entryDoc = await entriesRef.add({
      q,
      a,
      intent,
      synonyms,
      embedding, // number[]
      enabled,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      sourceSuggestionId: body.suggestionId,
    });

    // 4) 提案を reviewed 済みに更新
    await sugRef.set(
      {
        reviewed: true,
        approvedAt: FieldValue.serverTimestamp(),
        entryId: entryDoc.id,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, entryId: entryDoc.id });
  } catch (err: any) {
    console.error("/api/ai/kb/approve error", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
