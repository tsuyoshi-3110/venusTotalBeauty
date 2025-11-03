// src/app/api/ai-unknown/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?siteKey=xxxxx
 * aiNotifications から「未対応（resolved=false または null）」の質問を取得して
 * sentAt の新しい順で返す（最大100件）
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteKey = searchParams.get("siteKey");
    if (!siteKey) {
      return NextResponse.json(
        { ok: false, error: "siteKey is required" },
        { status: 400 }
      );
    }

    const base = adminDb.collection("aiNotifications").where("siteKey", "==", siteKey);

    // resolved=false と resolved=null を別々に取得（インデックス要件を緩和）
    const [snapFalse, snapNull] = await Promise.all([
      base.where("resolved", "==", false).limit(200).get(),
      base.where("resolved", "==", null).limit(200).get(),
    ]);

    // マージ＆重複排除
    const docs = [...snapFalse.docs, ...snapNull.docs];
    const uniq = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const d of docs) uniq.set(d.id, d);

    // sentAt 降順で並べ替え（null は最後）
    const items = Array.from(uniq.values())
      .map((d) => {
        const data = d.data() as any;
        const sentAt: Date | null =
          data.sentAt?.toDate?.() ??
          (data.sentAt instanceof Date ? data.sentAt : null);
        return {
          id: d.id,
          question: data.question ?? "",
          sentAt,
          ownerEmail: data.ownerEmail ?? null,
        };
      })
      .sort((a, b) => {
        const ta = a.sentAt ? a.sentAt.getTime() : 0;
        const tb = b.sentAt ? b.sentAt.getTime() : 0;
        return tb - ta;
      })
      .slice(0, 100);

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    console.error("ai-unknown/list error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
