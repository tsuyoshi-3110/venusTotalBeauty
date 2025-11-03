// app/api/collab-ideas/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReqBody = {
  my: { industry: string };
  partner: {
    id: string;
    siteName: string;
    industry: string;
    distanceKm?: number | null;
  };
  context?: {
    season?: string;
    goal?: string;
    audience?: string;
    tone?: "pop" | "calm" | "premium";
  };
};

const MIN_IDEAS = 3;
const MAX_IDEAS = 6;
const BANNED_WHEN_FAR = ["距離面で取り組みやすい", "徒歩", "同日来店", "はしご", "ハシゴ", "店頭回遊"];

function distanceBand(d?: number | null) {
  if (d == null || !Number.isFinite(d)) return "unknown" as const;
  if (d < 3) return "near" as const;
  if (d < 10) return "mid" as const;
  return "far" as const;
}

function sanitize(ideasIn: unknown[], band: ReturnType<typeof distanceBand>) {
  let ideas = (Array.isArray(ideasIn) ? ideasIn : [])
    .map((s) => String(s ?? "").trim())
    .filter((s) => s.length > 0);

  if (band === "far" || band === "unknown") {
    ideas = ideas.filter((s) => !BANNED_WHEN_FAR.some((ng) => s.includes(ng)));
  }

  // 重複除去
  const set = new Set<string>();
  ideas = ideas.filter((s) => {
    const key = s.replace(/\s+/g, " ");
    if (set.has(key)) return false;
    set.add(key);
    return true;
  });

  // 件数制御
  if (ideas.length > MAX_IDEAS) ideas = ideas.slice(0, MAX_IDEAS);
  return ideas;
}

export async function POST(req: Request) {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "missing OPENAI_API_KEY" }, { status: 500 });
    }

    const body = (await req.json()) as ReqBody;
    const myIndustry = (body?.my?.industry ?? "未設定").trim();
    const partner = body?.partner;
    if (!partner?.id) {
      return NextResponse.json({ error: "bad partner" }, { status: 400 });
    }

    const band = distanceBand(partner.distanceKm ?? null);

    const sys = [
      "あなたはローカルビジネスの協業プランナーです。",
      "入力（自店業種 / 相手業種 / 距離km / 距離帯 / 任意の文脈）を踏まえ、低コストで実行しやすい協業アイデアを日本語で出してください。",
      "出力は必ず JSON のみ。各アイデアは20〜60字程度で具体的に、重複を避け、多様性を持たせること。",
      "",
      "距離帯ルール：",
      "- near: 近接施策（相互送客、セット割、店頭連携 等）を優先。",
      "- mid: 定期イベントや予約連携＋オンライン併用を推奨。『同日来店』に固定しない。",
      "- far/unknown: オンライン/デジタル/EC/同梱/ライブ配信/配送 等“距離非依存”を中心。徒歩・同日来店・店頭回遊・はしご等の文言は禁止。",
      "",
      "禁止事項：固有情報の捏造、一般論だけの羅列。",
      `フォーマット: {"reason":"...","ideas":["...","..."]}（ideasは${MIN_IDEAS}〜${MAX_IDEAS}件）`
    ].join("\n");

    const user = {
      myIndustry,
      partner: {
        siteName: partner.siteName,
        industry: partner.industry || "未設定",
        distanceKm: partner.distanceKm ?? null,
        distanceBand: band,
      },
      context: body?.context ?? {},
      requiredIdeas: { min: MIN_IDEAS, max: MAX_IDEAS },
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: "次のJSONを読み、仕様に沿ったJSONのみ返してください。" },
          { role: "user", content: JSON.stringify(user) },
        ],
      }),
    });

    if (!r.ok) {
      const body = await r.text();
      return NextResponse.json({ error: "openai", body: body.slice(0, 1000) }, { status: 502 });
    }

    // ★ 重要：choices[0].message.content を取り出す
    const data = await r.json();
    const content = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (!content) {
      return NextResponse.json(
        { error: "empty content from openai", body: JSON.stringify(data).slice(0, 800) },
        { status: 502 }
      );
    }

    // コードフェンス対策
    const cleaned = content.replace(/```json|```/g, "").trim();

    let j: any;
    try {
      j = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "bad ai json", raw: cleaned.slice(0, 800) }, { status: 502 });
    }

    const reason = String(j?.reason ?? "").trim();
    const ideas = sanitize(j?.ideas, band);

    if (!ideas || ideas.length === 0) {
      return NextResponse.json({ error: "no ideas from ai", raw: cleaned.slice(0, 800) }, { status: 502 });
    }

    return NextResponse.json({ used: "openai", reason, ideas });
  } catch (e: any) {
    return NextResponse.json(
      { error: "collab-ideas failed", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
