import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  const { title, keywords } = await req.json();

  if (!title) {
    return NextResponse.json({ error: "タイトルが必要です" }, { status: 400 });
  }

  // キーワードがある場合に備える（必須ではない）
  const keywordText =
    Array.isArray(keywords) && keywords.length > 0
      ? `キーワード: ${keywords.join("、")} を参考に`
      : "";

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `あなたは、商品・サービス・作品・施工実績などを親しみやすく簡潔に紹介するプロのコピーライターです。
紹介文は、どのような対象でも自然に読めるように仕上げてください。
価格・メーカー名・産地などの具体的な数値情報や宣伝文句は使わず、150文字以内にまとめてください。`,
    },
    {
      role: "user",
      content: `タイトル: ${title}\n${keywordText}紹介文を150文字以内で作成してください。`,
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-5-chat-latest",
    messages,
    temperature: 0.8,
    max_tokens: 300,
  });

  const description = completion.choices[0].message.content?.trim();
  return NextResponse.json({ body: description });
}
