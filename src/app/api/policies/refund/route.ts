// src/app/api/policies/refund/route.ts
import { NextRequest, NextResponse } from "next/server";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { adminAuth } from "@/lib/firebase-admin";

// ドキュメント参照を一元化
const refundDocRef = (siteKey: string) =>
  adminDb.doc(`sites/${siteKey}/policies/refund`);

export async function GET(req: NextRequest) {
  try {
    const siteKey = req.nextUrl.searchParams.get("siteKey");
    if (!siteKey) {
      return NextResponse.json(
        { error: "siteKey is required" },
        { status: 400 }
      );
    }

    const snap = await refundDocRef(siteKey).get();
    const policy = snap.exists ? snap.data() : null;

    return NextResponse.json({ policy }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "GET failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authz = req.headers.get("authorization") || "";
    const m = authz.match(/^Bearer (.+)$/);
    if (!m)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(m[1]);

    const { siteKey, policy } = (await req.json()) as {
      siteKey?: string;
      policy?: Record<string, any>;
    };

    if (!siteKey || !policy) {
      return NextResponse.json(
        { error: "siteKey and policy are required" },
        { status: 400 }
      );
    }

    // （任意の厳格チェック）このサイトのオーナーか確認
    const siteSnap = await adminDb.doc(`siteSettings/${siteKey}`).get();
    const ownerId = siteSnap.exists ? siteSnap.get("ownerId") : null;
    if (!ownerId || ownerId !== decoded.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await refundDocRef(siteKey).set(
      { ...policy, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "POST failed" },
      { status: 500 }
    );
  }
}
