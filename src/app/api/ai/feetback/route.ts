// app/api/ai/feedback/route.ts
// 役割: チャット回答に対するフィードバック（👍/👎 + 追補テキスト）を保存
//       必要に応じて KB 提案 (/aiKB/suggestions) を作成
// 依存: Firebase Admin（adminDb）, SITE_KEY

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================== 型 ================== */
type Thumbs = "up" | "down";

type FeedbackBody = {
  threadId: string;
  thumbs: Thumbs; // "up" | "down"
  feedbackText?: string; // 追補・不足・感想
  proposeToKB?: boolean; // KB提案に回す
  uid?: string | null;   // 任意
  anonId?: string | null; // 任意
  lang?: string; // "ja" など
};

/* ================== Firestore paths ================== */
const siteRoot = (siteKey: string) => `sites/${siteKey}`;
const threadDocPath = (siteKey: string, threadId: string) => `${siteRoot(siteKey)}/aiThreads/${threadId}`;
const threadMsgsColPath = (siteKey: string, threadId: string) => `${threadDocPath(siteKey, threadId)}/messages`;
const feedbackColPath = (siteKey: string) => `${siteRoot(siteKey)}/aiLogs`; // 集約ログ置き場
const kbSuggestionColPath = (siteKey: string) => `${siteRoot(siteKey)}/aiKB/root/suggestions`;

/* ================== Utils ================== */
function clampText(s: string | undefined, max = 4000) {
  if (!s) return "";
  const t = String(s);
  return t.length > max ? t.slice(0, max) : t;
}

function detectIntent(text: string): string {
  const t = (text || "").toLowerCase();
  if (/予約|空き|いつ|日程/.test(t)) return "reservation";
  if (/価格|値段|いくら|料金|見積/.test(t)) return "pricing";
  if (/営業時間|定休日|何時|開店|閉店/.test(t)) return "hours";
  if (/アクセス|場所|駐車|行き方/.test(t)) return "access";
  if (/支払|決済|カード|請求/.test(t)) return "payment";
  if (/配送|出張|対応エリア|エリア/.test(t)) return "service-area";
  if (/キャンセル|返金|変更/.test(t)) return "policy";
  return "general";
}

/* ================== Main ================== */
export async function POST(req: NextRequest) {
  try {
    const siteKey = SITE_KEY;
    const body = (await req.json()) as FeedbackBody;

    if (!body?.threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }
    if (body.thumbs !== "up" && body.thumbs !== "down") {
      return NextResponse.json({ error: "thumbs must be 'up' or 'down'" }, { status: 400 });
    }

    // 最新の assistant メッセージを取得
    const msgsSnap = await adminDb
      .collection(threadMsgsColPath(siteKey, body.threadId))
      .where("role", "==", "assistant")
      .orderBy("ts", "desc")
      .limit(1)
      .get();

    if (msgsSnap.empty) {
      return NextResponse.json({ error: "assistant message not found for this thread" }, { status: 404 });
    }

    const lastAssistant = msgsSnap.docs[0]?.data()?.content ?? "";
    const intent = detectIntent(body.feedbackText || lastAssistant);

    // 1) ログ保存（集約ビュー）
    const logRef = await adminDb.collection(feedbackColPath(siteKey)).add({
      siteKey,
      threadId: body.threadId,
      thumbs: body.thumbs,
      feedbackText: clampText(body.feedbackText, 1000),
      intent,
      answer: clampText(lastAssistant, 4000),
      uid: body.uid ?? null,
      anonId: body.anonId ?? null,
      lang: body.lang || "ja",
      createdAt: FieldValue.serverTimestamp(),
    });

    // 2) スレッド側のカウンタ更新
    const threadRef = adminDb.doc(threadDocPath(siteKey, body.threadId));
    await threadRef.set(
      {
        feedbackCount: FieldValue.increment(1),
        thumbsUpCount: body.thumbs === "up" ? FieldValue.increment(1) : FieldValue.increment(0),
        thumbsDownCount: body.thumbs === "down" ? FieldValue.increment(1) : FieldValue.increment(0),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 3) KB 提案（任意）
    let suggestionId: string | null = null;
    if (body.proposeToKB) {
      const sugRef = await adminDb.collection(kbSuggestionColPath(siteKey)).add({
        intent,
        question: clampText(body.feedbackText || "", 500), // ユーザー入力があれば質問の素にする
        proposedAnswer: clampText(lastAssistant, 2000),
        sourceThreadId: body.threadId,
        reviewed: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      suggestionId = sugRef.id;
    }

    return NextResponse.json({ ok: true, logId: logRef.id, suggestionId });
  } catch (err: any) {
    console.error("/api/ai/feedback error", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
