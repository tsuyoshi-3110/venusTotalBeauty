import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const { content, replies } = await req.json();

    // 最新の返信3件のみ使用（あれば）
    const recentReplies = (replies || [])
      .slice(-3)
      .map((r: any) => `・${r.content}`);

    console.log("🟩 投稿内容:", content);
    console.log("🟦 返信（最新3件）:", recentReplies);

    const prompt = `
以下はSNSでの投稿と、それに対する返信の一部です。
まず投稿内容をよく読み、投稿者の意図や悩みに丁寧に寄り添ってください。
そのうえで、もし返信の中に参考になる意見があれば考慮しても構いません。

投稿者に対して建設的で思いやりのあるアドバイスを、日本語で丁寧に提供してください。
誤字脱字を指摘したり、推測で内容を補ったりせず、嘘の情報を避け、優しくサポートしてください。

アドバイスは500文字以内でお願いします。

■ 投稿内容：
${content}

■ 最近の返信：
${
  recentReplies.length > 0
    ? recentReplies.join("\n")
    : "（返信はまだありません）"
}
`;

    const chat = await openai.chat.completions.create({
      model: "gpt-5.4",
      messages: [{ role: "user", content: prompt }],
    });

    const result = chat.choices[0].message.content?.trim();
    return NextResponse.json({ result });
  } catch (e) {
    console.error("❌ エラー:", e);
    return NextResponse.json(
      { error: "AI助言に失敗しました" },
      { status: 500 }
    );
  }
}
