import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  const { name, keywords } = await req.json();

  // 🔧 チェックを緩める：キーワード1個以上
  if (!name || !Array.isArray(keywords) || keywords.length < 1) {
    return NextResponse.json({ error: "不正な入力です" }, { status: 400 });
  }

  // 🔻 文章量の指示を追加（100文字以内など）
  const prompt = `以下のキーワードを含めて、自己紹介を作成してください。自然で親しみやすい文章にしてください。文章は短く、最大でも200文字程度にしてください。\nキーワード: ${keywords.join(
    ", "
  )}`;

  const chat = await openai.chat.completions.create({
    model: "gpt-5.4",
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    chat.choices[0].message.content?.trim() ?? "紹介文の生成に失敗しました";

  return NextResponse.json({ text });
}
