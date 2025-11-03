// src/app/api/sellers/onboarding-completed/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { siteKey, completed } = await req.json();

    if (typeof siteKey !== "string" || typeof completed !== "boolean") {
      return NextResponse.json({ error: "bad-request" }, { status: 400 });
    }

    // Firebase Auth の ID トークンを検証
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(idToken);

    // オーナー確認（siteSettings/{siteKey}.ownerId と一致するか）
    const siteSnap = await adminDb.collection("siteSettings").doc(siteKey).get();
    if (!siteSnap.exists) return NextResponse.json({ error: "site-not-found" }, { status: 404 });

    const ownerId = siteSnap.get("ownerId");
    if (ownerId !== decoded.uid) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // 書き込み（Admin SDK）
    await adminDb
      .collection("siteSellers")
      .doc(siteKey)
      .set({ stripe: { onboardingCompleted: completed } }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("onboarding-completed error:", e);
    return NextResponse.json(
      { error: "internal", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
