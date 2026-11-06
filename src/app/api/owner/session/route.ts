import { NextResponse } from "next/server";
import { isCurrentSiteOwner, OWNER_SESSION_COOKIE } from "@/lib/auth/page-owner";
import { adminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AGE_SECONDS = 60 * 60 * 24;

/** オーナー本人のIDトークンから、注文ページ閲覧用のセッションCookieを発行します。 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let uid: string;
  try {
    ({ uid } = await adminAuth.verifyIdToken(token));
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await isCurrentSiteOwner(uid))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const session = await adminAuth.createSessionCookie(token, {
    expiresIn: MAX_AGE_SECONDS * 1000,
  });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(OWNER_SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(OWNER_SESSION_COOKIE);
  return response;
}
