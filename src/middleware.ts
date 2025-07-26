// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// siteKeyをURLから取得し、使用可否を判断するミドルウェア
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 例: /home などをフィルタリング（対象のパスだけチェック）
  if (pathname.startsWith("/home")) {
    const siteKey = "venusTotalBeaty"; // ← あなたのURL構成に応じて動的に取得できるなら修正

    const siteRef = doc(db, "siteSettings", siteKey);
    const siteSnap = await getDoc(siteRef);

    if (!siteSnap.exists()) {
      return new NextResponse("サイトが存在しません", { status: 404 });
    }

    const siteData = siteSnap.data();
    const isFree = siteData.isFreePlan;
    const isPaid = !!siteData.stripeSubscriptionId;

    if (!isFree && !isPaid) {
      return new NextResponse("支払いが未完了のためアクセスできません", {
        status: 403,
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/home"], // ← ✅ここに書く
};
