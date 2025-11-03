// src/lib/ai.ts (fix)
// LLM呼び出しラッパー & 軽量学習（メモリ抽出／スレッド要約）
// - OpenAI SDK 前提（必要に応じて他プロバイダにも差し替え可能）
// - 依存: npm i openai
// - 環境変数: OPENAI_API_KEY

import OpenAI from "openai";

// ====== 設定 ======
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  // ランタイム起動時に気づけるよう、ただしビルドは落とさない
  console.warn("[ai.ts] OPENAI_API_KEY が未設定です。開発環境ではダミー応答になります。");
}

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : (null as any);

// モデルは必要に応じて差し替え（コスト/速度のバランス）
const CHAT_MODEL = process.env.AI_CHAT_MODEL || "gpt-4.1-mini";
const JSON_MODEL = process.env.AI_JSON_MODEL || CHAT_MODEL;
const EMBED_MODEL = process.env.AI_EMBED_MODEL || "text-embedding-3-small";

// ====== 型 ======
export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export type MemoryDelta = {
  facts: string[];
  preferences: string[];
  tasks: string[];
  notToForget: string[];
};

// ====== ユーティリティ ======
function safeJsonParse<T = any>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function dedup(arr?: string[]): string[] {
  return Array.from(new Set((arr ?? []).map((s) => s.trim()).filter(Boolean)));
}

// ====== 1) 通常チャット応答 ======
export async function getAIResponse(opts: {
  system?: string;
  messages: ChatMessage[];
  temperature?: number;
}): Promise<{ content: string }> {
  // 開発時、キー未設定なら安全なダミー応答
  if (!openai) {
    const lastUser = opts.messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
    return { content: `【ダミー応答】${lastUser.slice(0, 120)}...` };
  }

  const msgs: ChatMessage[] = opts.system
    ? [{ role: "system", content: opts.system }, ...opts.messages]
    : opts.messages;

  const res = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: msgs as any,
    temperature: opts.temperature ?? 0.3,
  });

  const content = res.choices?.[0]?.message?.content?.trim() ?? "";
  return { content };
}

// ====== 2) メモリ抽出（facts / preferences / tasks / notToForget） ======
export async function getSummaryUpdate(opts: {
  memory: Partial<MemoryDelta> | null;
  latestUser: string;
  latestAssistant: string;
}): Promise<MemoryDelta | null> {
  if (!openai) {
    // ダミー：何も学習しない
    return { facts: [], preferences: [], tasks: [], notToForget: [] };
  }

  const system = "あなたは会話要約と事実抽出の達人です。JSONのみで返答。";
  const user = [
    "以下の最新対話から、会話メモリを更新してください。",
    "出力は必ず次のキーのみ: facts[], preferences[], tasks[], notToForget[]",
    "既存メモリと矛盾する場合は新しい方を優先。ただし確信が持てない場合は何も追加しない。",
    `既存メモリ: ${JSON.stringify(opts.memory ?? {})}`,
    `最新User: ${opts.latestUser}`,
    `最新Assistant: ${opts.latestAssistant}`,
  ].join("\n");

  const res = await openai.chat.completions.create({
    model: JSON_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0,
    response_format: { type: "json_object" as any },
  });

  const raw = res.choices?.[0]?.message?.content ?? "{}";
  const parsed = safeJsonParse<MemoryDelta>(raw, {
    facts: [],
    preferences: [],
    tasks: [],
    notToForget: [],
  });

  return {
    facts: dedup(parsed.facts),
    preferences: dedup(parsed.preferences),
    tasks: dedup(parsed.tasks),
    notToForget: dedup(parsed.notToForget),
  };
}

// ====== 3) スレッド要約（匿名・短文・個人情報マスク） ======
export async function summarizeThreadSnapshot(
  transcript: ChatMessage[]
): Promise<{
  summary: string; // 3-6行の要約
  bullets: string[]; // 重要ポイント
}> {
  if (!openai) {
    const joined = transcript.map((m) => `${m.role}: ${m.content}`).join(" | ");
    const short = joined.slice(0, 200);
    return { summary: `【ダミー要約】${short}...`, bullets: [] };
  }

  const sys = [
    "あなたは匿名化の専門家です。",
    "氏名・電話・住所・メール等の個人情報は必ず伏せる（[個人情報]と表記）。",
    "出力は短く簡潔に。",
  ].join("\n");

  const conv = transcript
    .map((m) => `${m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "System"}: ${m.content}`)
    .join("\n");

  const prompt = [
    "以下の会話を3〜6行で要約し、重要ポイントを箇条書きでも出力してください。",
    'JSONで返答: {"summary": string, "bullets": string[]}',
    "会話:\n" + conv,
  ].join("\n\n");

  const res = await openai.chat.completions.create({
    model: JSON_MODEL,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: prompt },
    ],
    temperature: 0,
    response_format: { type: "json_object" as any },
  });

  const raw = res.choices?.[0]?.message?.content ?? "{}";
  const parsed = safeJsonParse<{ summary: string; bullets: string[] }>(raw, {
    summary: "",
    bullets: [],
  });
  return parsed;
}

// ====== 4) ツール判定（将来用: 営業時間/料金/予約などを直接参照すべきか） ======
export function needsTool(question: string): boolean {
  const q = question.toLowerCase();
  return [
    "営業時間",
    "今日",
    "今",
    "混雑",
    "空き",
    "予約",
    "価格",
    "料金",
    "いくら",
    "値段",
    "配送料",
    "送料",
    "在庫",
  ].some((kw) => q.includes(kw));
}

// ====== 5) 埋め込み生成（RAG用、後段で利用） ======
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!openai) return texts.map(() => []);
  const res = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: texts,
  });

  // OpenAI SDK のレスポンスは { data: Array<{ embedding: number[]; ... }> }
  type EmbeddingItem = { embedding: number[] };
  const items = res.data as unknown as EmbeddingItem[];
  return items.map((d: EmbeddingItem) => d.embedding);
}

// 単文用のヘルパー
export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  return vec ?? [];
}
