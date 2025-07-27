import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  const { title } = await req.json();

  if (!title) {
    return NextResponse.json({ error: "タイトルが必要です" }, { status: 400 });
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "あなたは商品説明を日本語で親しみやすく簡潔に書くプロのコピーライターです。価格・メーカー名・産地の情報は一切含めず、150文字以内で仕上げてください。",
    },
    {
      role: "user",
      content: `商品タイトル: ${title}\n→ 150文字以内で親しみやすい紹介文を生成してください。価格・メーカー名・産地は書かないでください。`,
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages,
    temperature: 0.8,
    max_tokens: 300, // 150文字に相当するトークン数（英語より多めに）
  });

  const description = completion.choices[0].message.content?.trim();
  return NextResponse.json({ body: description });
}
