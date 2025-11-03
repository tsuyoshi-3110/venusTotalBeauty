// /app/api/mail/send/route.ts
import { NextResponse } from "next/server";
import { getGmail } from "@/lib/gmail";

function encodeMessage(msg: string) {
  // Base64URL
  return Buffer.from(msg)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sanitizeHeader(v: unknown) {
  return String(v ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function isEmail(s: unknown) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const to = sanitizeHeader(body?.to);
    const subject = sanitizeHeader(body?.subject || "");
    const text = String(body?.text ?? "");
    const replyTo = sanitizeHeader(body?.replyTo || "");
    const replyToName = sanitizeHeader(body?.replyToName || "");

    if (!isEmail(to)) {
      return NextResponse.json(
        { ok: false, error: "Invalid 'to' address" },
        { status: 400 }
      );
    }
    if (!subject) {
      return NextResponse.json(
        { ok: false, error: "Subject is required" },
        { status: 400 }
      );
    }
    if (!text) {
      return NextResponse.json(
        { ok: false, error: "Text body is required" },
        { status: 400 }
      );
    }

    const from = process.env.GOOGLE_GOOGLE_SENDER_EMAIL!;
    if (!isEmail(from)) {
      return NextResponse.json(
        { ok: false, error: "GOOGLE_GOOGLE_SENDER_EMAIL is not set correctly" },
        { status: 500 }
      );
    }

    const headers: string[] = [
      `From: ${from}`,
      `To: ${to}`,
      // Reply-To は任意
      ...(isEmail(replyTo)
        ? [
            `Reply-To: ${
              replyToName ? `"${replyToName}" <${replyTo}>` : replyTo
            }`,
          ]
        : []),
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
    ];

    const raw = [...headers, "", text].join("\r\n");

    const gmail = getGmail();
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodeMessage(raw) },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // Gmail のレスポンス本文を優先して表示
    const detail = e?.response?.data || e?.message || e;
    console.error("gmail send error:", detail);
    return NextResponse.json(
      { ok: false, error: typeof detail === "string" ? detail : "send failed" },
      { status: 500 }
    );
  }
}
