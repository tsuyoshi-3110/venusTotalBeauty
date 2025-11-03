// app/api/ai/chat/route.ts
// 役割: チャット応答の生成、ログ保存、スレッド要約、（同意時）メモリ学習
// 依存: adminDb（Firebase Admin）, SITE_KEY, src/lib/ai

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom"; // 既存プロジェクトの定数に合わせる
import {
  getAIResponse,
  summarizeThreadSnapshot,
  getSummaryUpdate,
  type ChatMessage,
} from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================== 型 ================== */
type APIMsg = { role: "user" | "assistant" | "system"; content: string };

type ChatBody = {
  threadId: string;
  messages: APIMsg[]; // 直近分だけでもOK（サーバ側でスレッド蓄積）
  uid?: string | null;
  anonId?: string | null;
  learn?: boolean; // 本人メモリへの保存に同意しているか
  lang?: string; // "ja" 等
  proposeToKB?: boolean; // 匿名提案に回すか（UIスイッチ）
};

/* ================== Firestore helpers ================== */
const siteRoot = (siteKey: string) => `sites/${siteKey}`;

function threadDocPath(siteKey: string, threadId: string) {
  return `${siteRoot(siteKey)}/aiThreads/${threadId}`;
}
function threadMsgsColPath(siteKey: string, threadId: string) {
  return `${threadDocPath(siteKey, threadId)}/messages`;
}
function threadSnapshotDocPath(siteKey: string, threadId: string) {
  return `${siteRoot(siteKey)}/aiThreadSnapshots/${threadId}`;
}
function subjectMemoryDocPath(siteKey: string, subjectId: string) {
  return `${siteRoot(siteKey)}/aiMemories/${subjectId}`;
}
function kbSuggestionColPath(siteKey: string) {
  return `${siteRoot(siteKey)}/aiKB/root/suggestions`;
}

async function loadMemory(siteKey: string, subjectId: string | null) {
  if (!subjectId) return null;
  const snap = await adminDb
    .doc(subjectMemoryDocPath(siteKey, subjectId))
    .get();
  return snap.exists ? (snap.data() as any) : null;
}

async function loadThreadSnapshot(siteKey: string, threadId: string) {
  const snap = await adminDb
    .doc(threadSnapshotDocPath(siteKey, threadId))
    .get();
  return snap.exists ? (snap.data() as any) : null;
}

function composeSystem(opts: {
  lang: string;
  threadSummary?: { summary?: string; bullets?: string[] } | null;
  memory?: any | null;
}) {
  const lines: string[] = [];
  lines.push(
    "あなたは店舗向けの多言語AIアシスタントです。正確・簡潔・誠実に回答する。"
  );
  if (opts.threadSummary?.summary) {
    lines.push("【この会話の前提・要約】");
    lines.push(opts.threadSummary.summary);
  }
  if (opts.memory) {
    const { profile, facts, preferences, tasks, notToForget } = opts.memory;
    lines.push("【ユーザーの既知メモリ（本人同意済み）】");
    if (profile) lines.push(`- プロファイル: ${JSON.stringify(profile)}`);
    if (facts?.length) lines.push(`- 事実: ${facts.join(" / ")}`);
    if (preferences?.length) lines.push(`- 好み: ${preferences.join(" / ")}`);
    if (tasks?.length) lines.push(`- タスク: ${tasks.join(" / ")}`);
    if (notToForget?.length) lines.push(`- 要注意: ${notToForget.join(" / ")}`);
  } else {
    lines.push("【ユーザーの既知メモリ】なし");
  }
  if (opts.lang === "ja") lines.push("日本語で返答する。");
  return lines.join("\n");
}

function toChatMessages(arr: APIMsg[]): ChatMessage[] {
  return arr.map((m) => ({
    role: m.role,
    content: (m.content ?? "").toString(),
  }));
}

function sanitizeMessages(arr: APIMsg[], max = 30): APIMsg[] {
  const allowed: APIMsg[] = [];
  for (const m of arr) {
    if (!m || !m.content) continue;
    if (m.role !== "user" && m.role !== "assistant" && m.role !== "system")
      continue;
    allowed.push({ role: m.role, content: String(m.content).slice(0, 4000) });
  }
  // 末尾優先で上限
  return allowed.slice(-max);
}

/* ================== メイン ================== */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatBody;
    const siteKey = SITE_KEY;

    if (!body?.threadId) {
      return NextResponse.json(
        { error: "threadId is required" },
        { status: 400 }
      );
    }
    const lang = body.lang || "ja";
    const messages = sanitizeMessages(body.messages || []);
    if (messages.length === 0) {
      return NextResponse.json(
        { error: "messages are required" },
        { status: 400 }
      );
    }

    // 1) スコープ判定
    const subjectId = body.uid ?? body.anonId ?? null;
    const consented = !!(subjectId && body.learn === true);

    // 2) 既存情報の読込
    const [threadSummary, memory] = await Promise.all([
      loadThreadSnapshot(siteKey, body.threadId),
      loadMemory(siteKey, consented ? subjectId : null),
    ]);

    // 3) システムプロンプト構築
    const system = composeSystem({ lang, threadSummary, memory });

    // 4) ツール判定（将来拡張）
    const lastUser =
      messages.filter((m) => m.role === "user").at(-1)?.content ?? "";

    // MEMO: shouldTool が true の場合、ここで Firestore/API ツールを呼び、根拠パッセージとしてメッセージに追加する設計に拡張可能。

    // 5) 応答生成
    const assistant = await getAIResponse({
      system,
      messages: toChatMessages(messages),
    });

    // 6) Firestore へ保存（メッセージ / スレッド）
    const threadRef = adminDb.doc(threadDocPath(siteKey, body.threadId));
    await threadRef.set(
      {
        siteKey,
        uid: body.uid ?? null,
        anonId: body.anonId ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const msgsCol = adminDb.collection(
      threadMsgsColPath(siteKey, body.threadId)
    );
    const now = FieldValue.serverTimestamp();

    const lastUserMsg = messages.at(-1);
    if (lastUserMsg?.role === "user") {
      await msgsCol.add({
        role: "user",
        content: lastUserMsg.content,
        ts: now,
      });
    }
    await msgsCol.add({
      role: "assistant",
      content: assistant.content,
      ts: now,
    });

    // 7) スレッド要約（匿名・短文）
    const transcript: ChatMessage[] = toChatMessages(
      messages.concat([{ role: "assistant", content: assistant.content }])
    );
    const snap = await summarizeThreadSnapshot(transcript);
    await adminDb.doc(threadSnapshotDocPath(siteKey, body.threadId)).set(
      {
        summary: snap.summary ?? "",
        bullets: Array.isArray(snap.bullets) ? snap.bullets : [],
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 8) 軽量学習（同意時のみ）
    if (consented && subjectId) {
      const memDelta = await getSummaryUpdate({
        memory,
        latestUser: lastUser,
        latestAssistant: assistant.content,
      });
      if (memDelta) {
        // 既存とマージ（重複除去）
        const prev = memory || {
          facts: [],
          preferences: [],
          tasks: [],
          notToForget: [],
        };
        const merged = {
          facts: dedup([...(prev.facts || []), ...(memDelta.facts || [])]),
          preferences: dedup([
            ...(prev.preferences || []),
            ...(memDelta.preferences || []),
          ]),
          tasks: dedup([...(prev.tasks || []), ...(memDelta.tasks || [])]),
          notToForget: dedup([
            ...(prev.notToForget || []),
            ...(memDelta.notToForget || []),
          ]),
        };
        await adminDb.doc(subjectMemoryDocPath(siteKey, subjectId)).set(
          {
            ...merged,
            updatedAt: FieldValue.serverTimestamp(),
            consent: { learn: true, lastUpdated: FieldValue.serverTimestamp() },
          },
          { merge: true }
        );
      }
    }

    // 9) （任意）匿名KB提案
    if (body.proposeToKB) {
      const intent = detectIntent(lastUser);
      await adminDb.collection(kbSuggestionColPath(siteKey)).add({
        intent,
        question: lastUser,
        proposedAnswer: assistant.content,
        sourceThreadId: body.threadId,
        reviewed: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ content: assistant.content });
  } catch (err: any) {
    console.error("/api/ai/chat error", err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}

/* ================== ローカル関数 ================== */
function dedup(arr: string[]) {
  return Array.from(
    new Set((arr || []).map((s) => String(s).trim()).filter(Boolean))
  );
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
