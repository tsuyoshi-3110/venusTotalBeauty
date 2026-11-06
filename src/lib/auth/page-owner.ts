import "server-only";

import { cookies } from "next/headers";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const OWNER_SESSION_COOKIE = "__session";

export async function isCurrentSiteOwner(uid: string): Promise<boolean> {
  const siteKey = SITE_KEY;
  const snapshot = await adminDb.doc(`siteSettings/${siteKey}`).get();
  return snapshot.exists && snapshot.get("ownerId") === uid;
}

/** ページ表示用：Cookieの持ち主が現在の店舗のオーナーか確認します。 */
export async function hasCurrentOwnerSession(): Promise<boolean> {
  const session = (await cookies()).get(OWNER_SESSION_COOKIE)?.value;
  if (!session) return false;

  try {
    const { uid } = await adminAuth.verifySessionCookie(session, true);
    return await isCurrentSiteOwner(uid);
  } catch {
    return false;
  }
}
