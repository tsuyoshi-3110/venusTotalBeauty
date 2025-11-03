// src/app/api/ai-knowledge/add/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { siteKey, question, answer, notificationId? }
 * - aiKnowledge/{siteKey}/docs/learned に items 追記
 * - 該当の aiNotifications を resolved=true に更新
 */
export async function POST(req: Request) {
  try {
    const { siteKey, question, answer, notificationId } = await req.json();

    if (!siteKey || !question || !answer) {
      return NextResponse.json({ ok: false, error: "siteKey, question, answer are required" }, { status: 400 });
    }

    // learned へ追記（配列マージ）
    const learnedRef = adminDb
      .collection("aiKnowledge")
      .doc(siteKey)
      .collection("docs")
      .doc("learned");

    const learnedSnap = await learnedRef.get();
    const existing = learnedSnap.exists ? learnedSnap.data()?.items ?? [] : [];
    const newItem = { question, answer, updatedAt: new Date() };
    await learnedRef.set({ items: [...existing, newItem] }, { merge: true });

    // 通知を既読化
    if (notificationId) {
      await adminDb.collection("aiNotifications").doc(notificationId).set(
        {
          resolved: true,
          resolvedAt: new Date(),
          answer,
        },
        { merge: true }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("ai-knowledge/add error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
