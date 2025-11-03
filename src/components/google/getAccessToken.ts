import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export async function getAccessToken(siteKey: string): Promise<string> {
  const snap = await getDoc(doc(db, "siteIntegrations", siteKey));
  const g = (snap.data() as any)?.google;
  if (!g?.refresh_token) throw new Error("Google refresh_token not found");

  if (g.access_token && g.expires_at && Date.now() < g.expires_at - 60_000) {
    return g.access_token as string;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: g.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Failed to refresh token");

  await setDoc(
    doc(db, "siteIntegrations", siteKey),
    {
      google: {
        ...g,
        access_token: json.access_token,
        expires_at: Date.now() + json.expires_in * 1000,
        token_type: json.token_type,
      },
      updatedAt: Date.now(),
    },
    { merge: true }
  );
  return json.access_token as string;
}
