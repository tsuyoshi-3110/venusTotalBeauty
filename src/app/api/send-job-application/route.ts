import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { google } from "googleapis";
import { db } from "@/lib/firebase"; // Firestore インスタンスを正しくインポート
import { doc, getDoc } from "firebase/firestore";

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_SENDER_EMAIL,
} = process.env;

const REDIRECT_URI = "https://developers.google.com/oauthplayground";

export async function POST(req: NextRequest) {
  const { name, email, phone, message, siteKey } = await req.json();

  if (!name || !email || !message || !siteKey) {
    return NextResponse.json(
      { error: "必須項目（name, email, message, siteKey）が不足しています" },
      { status: 400 }
    );
  }

  try {
    // ① Firestore から ownerEmail を取得
    const docRef = doc(db, "siteSettings", siteKey);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json(
        { error: "対象のサイト設定が見つかりませんでした" },
        { status: 404 }
      );
    }

    const ownerEmail = docSnap.data().ownerEmail;
    if (!ownerEmail) {
      return NextResponse.json(
        { error: "送信先メールアドレスが設定されていません" },
        { status: 500 }
      );
    }

    // ② OAuth2 でアクセストークン取得
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
      console.error("アクセストークンの取得に失敗:", accessTokenRes);
      return NextResponse.json(
        { error: "アクセストークンの取得に失敗しました" },
        { status: 500 }
      );
    }

    // ③ メール送信設定
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

    const mailOptions = {
      from: `求人応募フォーム <${GOOGLE_SENDER_EMAIL}>`,
      to: ownerEmail,
      subject: `【求人応募】${name}様より応募が届きました`,
      text: `
■ 氏名: ${name}
■ メールアドレス: ${email}
■ 電話番号: ${phone || "未入力"}
■ 応募動機:
${message}
      `,
    };

    await transport.sendMail(mailOptions);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("メール送信エラー:", error);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }
}
