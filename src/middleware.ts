// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { SITE_KEY } from "./lib/atoms/siteKeyAtom";

// siteKeyをURLから取得し、使用可否を判断するミドルウェア
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 例: /home などをフィルタリング（対象のパスだけチェック）
  if (pathname.startsWith("/home")) {
  

    const siteRef = doc(db, "siteSettings", SITE_KEY);
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
