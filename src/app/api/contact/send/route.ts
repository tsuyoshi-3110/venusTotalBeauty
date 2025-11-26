// src/app/api/contact/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { adminDb } from "@/lib/firebase-admin";
import OpenAI from "openai";

const SENDER =
  process.env.GOOGLE_GOOGLE_SENDER_EMAIL ||
  process.env.GOOGLE_SENDER_EMAIL ||
  "";
const CONTACT_TO_FALLBACK = process.env.CONTACT_TO || SENDER;

// ----- helpers -----

function b64url(str: string) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

// RFC 2047 "encoded-word" (Q-encoding for UTF-8) helper
function encodeWordQ(str: string) {
  const buf = Buffer.from(str ?? "", "utf8");
  let out = "";
  for (const b of buf) {
    if (
      (b >= 0x41 && b <= 0x5a) || // A-Z
      (b >= 0x61 && b <= 0x7a) || // a-z
      (b >= 0x30 && b <= 0x39) // 0-9
    ) {
      out += String.fromCharCode(b);
    } else if (b === 0x20) {
      out += "_";
    } else {
      out += "=" + b.toString(16).toUpperCase().padStart(2, "0");
    }
  }
  return `=?UTF-8?Q?${out}?=`;
}

async function resolveRecipient(siteKey?: string): Promise<string> {
  try {
    if (!siteKey) return CONTACT_TO_FALLBACK;
    const snap = await adminDb.doc(`siteSettings/${siteKey}`).get();
    const data = snap.exists ? (snap.data() as any) : null;
    return (data?.ownerEmail || CONTACT_TO_FALLBACK) as string;
  } catch {
    return CONTACT_TO_FALLBACK;
  }
}

/** OpenAI を使って本文だけ日本語へ翻訳（失敗時は null を返す） */
async function translateBodyToJa(body: string): Promise<string | null> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("[contact/send] OPENAI_API_KEY not set");
      return null;
    }
    const openai = new OpenAI({ apiKey });

    const SYSTEM_PROMPT = `
You are a professional translator.
- Return concise, natural translations for marketing/product descriptions.
- Preserve meaning and tone; avoid adding new content.
- Always return a strict JSON object with keys "title" and "body".
- If an input field is empty, return an empty string for that field.
- Preserve line breaks in values.
`.trim();

    const userPrompt = `
Translate the following JSON object into Japanese.
Return a strict JSON object with keys "title" and "body" only.
If an input field is empty, return an empty string for that key.
Preserve line breaks.

Input:
${JSON.stringify({ title: "", body })}
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    const translated =
      typeof parsed.body === "string" ? parsed.body.trim() : "";
    return translated || null;
  } catch (e: any) {
    console.warn("[contact/send] translateBodyToJa failed:", e?.message || e);
    return null;
  }
}

// ----- route -----

export async function POST(req: NextRequest) {
  try {
    let name = "";
    let email = "";
    let message = "";
    let website: string | undefined;
    let siteKey: string | undefined;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // ==== フロントからの FormData(multipart) 用 ====
      const formData = await req.formData();
      name = String(formData.get("name") ?? "");
      email = String(formData.get("email") ?? "");
      message = String(formData.get("message") ?? "");
      const websiteRaw = formData.get("website");
      const siteKeyRaw = formData.get("siteKey");

      website = websiteRaw ? String(websiteRaw) : undefined;
      siteKey = siteKeyRaw ? String(siteKeyRaw) : undefined;

      // 添付ファイル（今はメールに添付せず、受け取るだけ）
      // const files = formData.getAll("files"); // FormDataEntryValue = string | File
      // 必要になったらここで Gmail 用 MIME を組み立てれば OK
    } else {
      // ==== JSON 用（他のクライアントからのアクセスも許容）====
      const body = await req.json();
      name = body.name ?? "";
      email = body.email ?? "";
      message = body.message ?? "";
      website = body.website ?? undefined;
      siteKey = body.siteKey ?? undefined;
    }

    // 蜜鉢チェック
    if (website) {
      return NextResponse.json({ ok: true });
    }

    if (!email || !message) {
      return NextResponse.json(
        { error: "必須項目が不足しています。" },
        { status: 400 }
      );
    }

    const TO = await resolveRecipient(siteKey);

    // OpenAI で日本語訳（失敗時は null）
    const translatedJa = await translateBodyToJa(message);

    // Gmail OAuth2
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI ||
        "https://developers.google.com/oauthplayground"
    );
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const gmail = google.gmail({ version: "v1", auth: oauth2 });

    // 件名：「【問い合わせ】{名前}」形式（名前が無ければ email で代用）
    const subjectPlain = `【問い合わせ】${(name || "").trim() || email}`;
    const subjectHeader = encodeWordQ(subjectPlain);

    // 本文（原文 + 自動訳）
    const lines: string[] = [
      "=== お問い合わせ ===",
      `お名前: ${name || "-"}`,
      `メール: ${email}`,
      "",
      "▼ 内容",
      message,
    ];
    if (translatedJa && translatedJa !== message) {
      lines.push("", "▼ 日本語訳（自動）", translatedJa);
    }
    const plain = lines.join("\n");

    // ヘッダーの表示名も RFC 2047 で
    const fromName = encodeWordQ("お問い合わせ");
    const replyName = name ? encodeWordQ(name) : null;

    // 本文は base64 で送る
    const bodyB64 = Buffer.from(plain, "utf8").toString("base64");

    const raw = [
      `From: ${fromName} <${SENDER || email}>`,
      `To: ${TO}`,
      `Reply-To: ${replyName ? `${replyName} <${email}>` : email}`,
      "MIME-Version: 1.0",
      `Subject: ${subjectHeader}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      bodyB64,
    ].join("\r\n");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: b64url(raw) },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(
      "[contact/send] error:",
      err?.response?.data || err?.message || err
    );
    return NextResponse.json(
      { error: "送信に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 }
    );
  }
}
