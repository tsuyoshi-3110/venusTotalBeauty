// /src/app/api/ai-notify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isEmail(s: unknown): s is string {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Firestore: siteSettings/{siteKey}.ownerEmail を取得 */
async function fetchOwnerEmail(siteKey?: string): Promise<string | null> {
  if (!siteKey) return null;
  try {
    const snap = await adminDb.collection("siteSettings").doc(siteKey).get();
    const email = snap.exists ? (snap.data() as any)?.ownerEmail : null;
    return isEmail(email) ? email : null;
  } catch (e) {
    console.error("fetchOwnerEmail error:", e);
    return null;
  }
}

/** 現在のリクエストから /api/mail/send の絶対URLを生成 */
function mailApiUrl(req: NextRequest) {
  return new URL("/api/mail/send", req.url).toString();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { siteKey, question, fromEmail, fromName, to: toInBody } = body ?? {};

    if (!question) {
      return NextResponse.json(
        { ok: false, error: "question is required" },
        { status: 400 }
      );
    }

    // 1) 宛先解決：ownerEmail（最優先）→ body.to → env
    const ownerEmail = await fetchOwnerEmail(siteKey);
    const to =
      ownerEmail ||
      (isEmail(toInBody) ? toInBody : null) ||
      (isEmail(process.env.NOTIFY_EMAIL) ? process.env.NOTIFY_EMAIL! : null) ||
      (isEmail(process.env.GOOGLE_GOOGLE_SENDER_EMAIL)
        ? process.env.GOOGLE_GOOGLE_SENDER_EMAIL!
        : null);

    if (!to) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No recipient email. Please set siteSettings/{siteKey}.ownerEmail or NOTIFY_EMAIL / GOOGLE_GOOGLE_SENDER_EMAIL (or pass 'to').",
        },
        { status: 500 }
      );
    }

    // 2) メール内容
    const subject = `【AI相談・要確認】${siteKey ?? "unknown-site"}`;
    const text = [
      "AIが担当者確認を要求しました。",
      "",
      `サイトID: ${siteKey ?? "-"}`,
      ownerEmail ? `宛先（ownerEmail）: ${ownerEmail}` : null,
      fromName || fromEmail
        ? `問い合わせ者: ${[fromName, fromEmail].filter(Boolean).join(" / ")}`
        : null,
      "",
      "質問内容:",
      String(question),
      "",
      "（このメールは自動送信です）",
    ]
      .filter(Boolean)
      .join("\n");

    // 3) 既存の /api/mail/send を呼んで送信
    const res = await fetch(mailApiUrl(req), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, text }),
    });

    const raw = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(raw);
    } catch {
      /* 非JSONでもOK */
    }

    if (!res.ok) {
      console.error("ai-notify: mail/send failed", {
        status: res.status,
        statusText: res.statusText,
        body: raw,
      });
      return NextResponse.json(
        { ok: false, error: data?.error || "mail send failed" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("ai-notify error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
