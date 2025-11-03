// app/api/job/apply/route.ts
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import OpenAI from "openai";

// ✅ Node ランタイム（Edge では nodemailer が動きません）
export const runtime = "nodejs";
// 予約/問い合わせはキャッシュしない
export const dynamic = "force-dynamic";

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_SENDER_EMAIL,
  OPENAI_API_KEY,
} = process.env;

// OAuth Playground でリフレッシュトークンを発行している前提
const REDIRECT_URI = "https://developers.google.com/oauthplayground";

/* ----------------------------- utils ----------------------------- */

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isPhone = (v: string) => /^[0-9+\-() ]{8,}$/.test(v); // シンプル検証
const isISODate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isHHmm = (v: string) => /^\d{2}:\d{2}$/.test(v);

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Firestore から ownerEmail を取得。 */
async function resolveOwnerEmail(): Promise<string | null> {
  if (!SITE_KEY) return null;

  try {
    const ref1 = doc(db, "siteSettings", SITE_KEY);
    const snap1 = await getDoc(ref1);
    if (snap1.exists()) {
      const email = snap1.data()?.ownerEmail as string | undefined;
      if (email && isEmail(email)) return email;
    }
  } catch {}

  try {
    const ref2 = doc(db, "siteSettingsEditable", SITE_KEY);
    const snap2 = await getDoc(ref2);
    if (snap2.exists()) {
      const email = snap2.data()?.ownerEmail as string | undefined;
      if (email && isEmail(email)) return email;
    }
  } catch {}

  return null;
}

/** 本文テキストを日本語に翻訳（日本語らしければそのまま / 失敗時は null） */
async function translateBodyToJaIfNeeded(body: string): Promise<string | null> {
  const text = (body || "").trim();
  if (!text) return null;

  // かんたんな日本語検出（ひらがな/カタカナ/漢字が一定割合あれば日本語とみなす）
  const jpChars = (text.match(/[\u3040-\u30FF\u4E00-\u9FFF]/g) || []).length;
  if (jpChars / Math.max(text.length, 1) > 0.2) {
    return null; // すでに日本語っぽい
  }

  if (!OPENAI_API_KEY) return null;

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const SYSTEM_PROMPT = `
You are a professional Japanese translator.
- Output concise, natural Japanese.
- Do not add content; keep meaning and tone.
- Return a strict JSON object with key "body".
- Preserve line breaks.
`.trim();

    const userPrompt = `
Translate the following text into Japanese. Keep line breaks.

Input:
${JSON.stringify({ body: text })}
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
    const translated: string =
      typeof parsed.body === "string" ? parsed.body.trim() : "";

    if (!translated || translated === text) return null;
    return translated;
  } catch (e) {
    console.warn(
      "[job/apply] translateBodyToJaIfNeeded failed:",
      (e as any)?.message || e
    );
    return null;
  }
}

/* ----------------------------- handler ----------------------------- */

export async function POST(req: NextRequest) {
  // 1) 入力の取り出し（siteKey は受け取らない設計）
  let payload: {
    // 新フォーム（推奨：予約/依頼）
    name?: string;
    email?: string;
    phone?: string;
    date?: string; // YYYY-MM-DD
    time?: string; // HH:mm
    address?: string;
    notes?: string;

    // 旧フォーム互換（message のみ）
    message?: string;
  };

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON のパースに失敗しました" },
      { status: 400 }
    );
  }

  // 2) 正規化
  const name = (payload.name || "").trim();
  const email = (payload.email || "").trim();
  const phone = (payload.phone || "").trim();
  const date = (payload.date || "").trim();
  const time = (payload.time || "").trim();
  const address = (payload.address || "").trim();
  const notes = (payload.notes || "").trim();
  const messageRaw = (payload.message || "").trim(); // 旧互換

  // 3) 必須チェック
  if (!name) {
    return NextResponse.json({ error: "お名前は必須です" }, { status: 400 });
  }
  if (!email || !isEmail(email)) {
    return NextResponse.json(
      { error: "メールアドレスが未入力か形式が不正です" },
      { status: 400 }
    );
  }

  // 新フォーム（予約/依頼）と旧フォーム（message）の切り分け
  const isNewForm = !!(date && time);
  if (isNewForm) {
    if (!phone || !isPhone(phone)) {
      return NextResponse.json(
        { error: "電話番号が未入力か形式が不正です" },
        { status: 400 }
      );
    }
    if (!isISODate(date)) {
      return NextResponse.json(
        { error: "ご希望日が不正です（YYYY-MM-DD）" },
        { status: 400 }
      );
    }
    if (!isHHmm(time)) {
      return NextResponse.json(
        { error: "ご希望時間が不正です（HH:mm）" },
        { status: 400 }
      );
    }
    if (!address) {
      return NextResponse.json({ error: "ご住所は必須です" }, { status: 400 });
    }
    if (!notes) {
      return NextResponse.json(
        { error: "ご要望・相談内容は必須です" },
        { status: 400 }
      );
    }
  } else {
    // 旧仕様：message 必須
    if (!messageRaw) {
      return NextResponse.json(
        { error: "メッセージが空です" },
        { status: 400 }
      );
    }
  }

  // 4) env チェック（メール送信に必要なもの）
  if (
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    !GOOGLE_REFRESH_TOKEN ||
    !GOOGLE_SENDER_EMAIL
  ) {
    return NextResponse.json(
      { error: "メール送信設定(env)が不足しています" },
      { status: 500 }
    );
  }

  try {
    // 5) 送信先 ownerEmail 解決
    let ownerEmail = await resolveOwnerEmail();
    if (!ownerEmail) {
      console.warn(
        "[job/apply] ownerEmail を Firestore から取得できませんでした。GOOGLE_SENDER_EMAIL を宛先に使用します。"
      );
      ownerEmail = GOOGLE_SENDER_EMAIL!;
    }

    // 6) OAuth2 アクセストークン
    const oAuth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    );
    oAuth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

    const accessTokenRes = await oAuth2Client.getAccessToken();
    const token =
      typeof accessTokenRes === "string"
        ? accessTokenRes
        : accessTokenRes?.token;

    if (!token) {
      console.error("アクセストークン取得失敗:", accessTokenRes);
      return NextResponse.json(
        { error: "アクセストークンの取得に失敗しました" },
        { status: 500 }
      );
    }

    // 7) Nodemailer
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: GOOGLE_SENDER_EMAIL,
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        refreshToken: GOOGLE_REFRESH_TOKEN,
        accessToken: token,
      },
    });

    // 8) 翻訳（必要な場合のみ）
    const originalBody = isNewForm ? notes : messageRaw;
    const translatedJa = await translateBodyToJaIfNeeded(originalBody);

    // 9) メール本文の構築
    const subjectNew = `【ご依頼】${name} 様よりお問い合わせ`;
    const subjectOld = `【ご依頼】${name} 様よりメッセージ`;

    const textNew = [
      "■ ご依頼内容が届きました",
      "",
      `■ お名前: ${name}`,
      `■ メール: ${email}`,
      `■ 電話: ${phone}`,
      `■ ご希望日時: ${date} ${time}`,
      `■ ご住所: ${address}`,
      "",
      "■ ご要望・相談内容（原文）:",
      notes,
      ...(translatedJa ? ["", "■ 日本語訳（自動）:", translatedJa] : []),
      "",
      `※このメールに返信すると、お客様（${email}）へ返信できます。`,
    ].join("\n");

    const htmlNew = `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial;line-height:1.7">
        <h2 style="margin:0 0 12px">ご依頼内容が届きました</h2>
        <table style="border-collapse:collapse">
          <tr><td style="padding:2px 8px 2px 0"><strong>お名前</strong></td><td>${escapeHtml(
            name
          )}</td></tr>
          <tr><td style="padding:2px 8px 2px 0"><strong>メール</strong></td><td>${escapeHtml(
            email
          )}</td></tr>
          <tr><td style="padding:2px 8px 2px 0"><strong>電話</strong></td><td>${escapeHtml(
            phone
          )}</td></tr>
          <tr><td style="padding:2px 8px 2px 0"><strong>ご希望日時</strong></td><td>${escapeHtml(
            `${date} ${time}`
          )}</td></tr>
          <tr><td style="padding:2px 8px 2px 0"><strong>ご住所</strong></td><td>${escapeHtml(
            address
          )}</td></tr>
        </table>

        <h3 style="margin:16px 0 8px">ご要望・相談内容（原文）</h3>
        <pre style="white-space:pre-wrap;background:#f7f7f7;padding:12px;border-radius:8px">${escapeHtml(
          notes
        )}</pre>

        ${
          translatedJa
            ? `<h3 style="margin:16px 0 8px">日本語訳（自動）</h3>
        <pre style="white-space:pre-wrap;background:#f0f7ff;padding:12px;border-radius:8px">${escapeHtml(
          translatedJa
        )}</pre>`
            : ""
        }

        <p style="margin-top:16px;color:#666">
          このメールに返信すると、お客様（${escapeHtml(email)}）へ返信できます。
        </p>
      </div>
    `;

    const textOld = [
      "■ ご依頼メッセージが届きました（旧フォーム）",
      "",
      `■ お名前: ${name}`,
      `■ メール: ${email}`,
      "",
      "■ メッセージ（原文）:",
      messageRaw,
      ...(translatedJa ? ["", "■ 日本語訳（自動）:", translatedJa] : []),
      "",
      `※このメールに返信すると、お客様（${email}）へ返信できます。`,
    ].join("\n");

    const htmlOld = `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial;line-height:1.7">
        <h2 style="margin:0 0 12px">ご依頼メッセージが届きました（旧フォーム）</h2>
        <table style="border-collapse:collapse">
          <tr><td style="padding:2px 8px 2px 0"><strong>お名前</strong></td><td>${escapeHtml(
            name
          )}</td></tr>
          <tr><td style="padding:2px 8px 2px 0"><strong>メール</strong></td><td>${escapeHtml(
            email
          )}</td></tr>
        </table>

        <h3 style="margin:16px 0 8px">メッセージ（原文）</h3>
        <pre style="white-space:pre-wrap;background:#f7f7f7;padding:12px;border-radius:8px">${escapeHtml(
          messageRaw
        )}</pre>

        ${
          translatedJa
            ? `<h3 style="margin:16px 0 8px">日本語訳（自動）</h3>
        <pre style="white-space:pre-wrap;background:#f0f7ff;padding:12px;border-radius:8px">${escapeHtml(
          translatedJa
        )}</pre>`
            : ""
        }

        <p style="margin-top:16px;color:#666">
          このメールに返信すると、お客様（${escapeHtml(email)}）へ返信できます。
        </p>
      </div>
    `;

    const useNew = isNewForm;

    // 10) 送信
    await transport.sendMail({
      from: `ご依頼フォーム <${GOOGLE_SENDER_EMAIL}>`,
      to: ownerEmail,
      replyTo: email, // 受信側がそのまま返信できる
      subject: useNew ? subjectNew : subjectOld,
      text: useNew ? textNew : textOld,
      html: useNew ? htmlNew : htmlOld,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("メール送信エラー:", error);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }
}
