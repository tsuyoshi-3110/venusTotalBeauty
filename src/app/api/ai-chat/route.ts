// src/app/api/ai-chat/route.ts（RAG＋在庫ツール統合・自然回答版）
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { adminDb } from "@/lib/firebase-admin";
import { LANG_NAME, t } from "@/config/ai-site";
import { AI_SITE } from "@/config/site";
import { retrieveKB, hitsToPassages } from "@/lib/kb";
import { inventoryPassages } from "@/lib/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/* ================================
   Utils
================================ */

async function getOwnerPrompt(siteKey: string) {
  try {
    const snap = await adminDb
      .collection("aiKnowledge")
      .doc(siteKey)
      .collection("docs")
      .doc("prompt")
      .get();
    const d = (snap.data() as any) ?? {};
    const system = typeof d.system === "string" ? d.system.trim() : "";
    const styleBullets = Array.isArray(d.styleBullets)
      ? d.styleBullets.map((s: any) => String(s).trim()).filter(Boolean)
      : [];
    const disclaimers = Array.isArray(d.disclaimers)
      ? d.disclaimers.map((s: any) => String(s).trim()).filter(Boolean)
      : [];
    return { system, styleBullets, disclaimers } as {
      system: string;
      styleBullets: string[];
      disclaimers: string[];
    };
  } catch {
    return { system: "", styleBullets: [], disclaimers: [] };
  }
}

function resolveBaseUrl(req: NextRequest) {
  const env = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (env) return env;
  try {
    return req.nextUrl.origin;
  } catch {
    const host = req.headers.get("host") ?? "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
  }
}

async function getItems(ref: FirebaseFirestore.DocumentReference) {
  const snap = await ref.get();
  const data = snap.exists ? (snap.data() as any) : null;
  return (data?.items ?? []) as { question?: string; answer?: string }[];
}

function qaToText(
  label: string,
  qa: { question?: string; answer?: string }[],
  limit = 20
) {
  const body = qa
    .slice(0, limit)
    .map((x) => {
      const q = (x.question ?? "").trim().replace(/\s+/g, " ").slice(0, 400);
      const a = (x.answer ?? "").trim().replace(/\s+/g, " ").slice(0, 600);
      return `Q: ${q}\nA: ${a}`;
    })
    .join("\n---\n");
  return body ? `【${label}】\n${body}` : "";
}

async function getKeywordsKnowledge(
  siteKey: string,
  max = AI_SITE.limits.keywords
) {
  try {
    const ref = adminDb
      .collection("aiKnowledge")
      .doc(siteKey)
      .collection("docs")
      .doc("keywords");
    const snap = await ref.get();
    const data = (snap.data() as any) ?? {};
    const items: string[] = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) return "";
    const lines = items
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .slice(0, max)
      .map((s) => `- ${s}`);
    return lines.length > 0
      ? `【オーナーキーワード】\n${lines.join("\n")}`
      : "";
  } catch {
    return "";
  }
}

function extractPriceFromText(txt: string): string {
  const m = String(txt).match(
    /(¥\s?\d{1,3}(?:,\d{3})+|\d{1,3}(?:,\d{3})+円|\d{4,})(?:\s?円)?/
  );
  if (!m) return "";
  const v = m[0].replace(/\s+/g, "");
  return /[円¥]/.test(v) ? v : `¥${Number(v).toLocaleString()}`;
}

function pickPrice(it: any): string {
  const num =
    it?.priceIncl ??
    it?.price ??
    it?.priceWithTax ??
    it?.priceTaxIncluded ??
    it?.jpy;
  if (typeof num === "number") return `¥${num.toLocaleString()}`;

  const cand =
    (typeof it?.priceText === "string" && it.priceText.trim()) ||
    (typeof it?.priceJP === "string" && it.priceJP.trim()) ||
    (typeof it?.priceLabel === "string" && it.priceLabel.trim());
  if (cand) return String(cand);

  const blob = [
    it?.titleI18n?.ja,
    it?.title,
    it?.body,
    it?.shortDesc,
    it?.description,
    it?.note,
  ]
    .filter(Boolean)
    .join(" ");
  return extractPriceFromText(blob);
}

function pickDuration(it: any): string {
  const s =
    (typeof it?.durationText === "string" && it.durationText) ||
    (it?.durationMin ? `${it.durationMin}分` : undefined);
  if (s) return s;
  const blob = [it?.shortDesc, it?.description, it?.body]
    .filter(Boolean)
    .join(" ");
  const m = blob.match(/(\d{1,3})\s*分/);
  return m ? `${m[1]}分` : "";
}

async function getMenuKnowledgeFromFirestore(siteKey: string) {
  try {
    const secSnap = await adminDb
      .collection("menuSections")
      .where("siteKey", "==", siteKey)
      .orderBy("order", "asc")
      .get();

    if (secSnap.empty) return "";

    const blocks: string[] = [];

    for (const d of secSnap.docs) {
      const s = d.data() as any;
      const sectionTitle =
        (s?.titleI18n?.ja as string | undefined) ??
        (s?.title as string | undefined);
      if (!sectionTitle?.trim()) continue;

      const lines: string[] = [];
      try {
        const itemsSnap = await d.ref
          .collection("items")
          .orderBy("order", "asc")
          .get();

        itemsSnap.forEach((itDoc) => {
          const it = itDoc.data() as any;
          const name =
            (it?.titleI18n?.ja as string | undefined) ??
            (it?.title as string | undefined) ??
            "";
          const priceStr = pickPrice(it);
          const durStr = pickDuration(it);
          const note = String(
            (it?.shortDesc as string | undefined) ??
              (it?.description as string | undefined) ??
              ""
          );

          const line = [
            name ? `- ${name}` : "",
            priceStr ? `：${priceStr}` : "",
            durStr ? `／目安${durStr}` : "",
            note ? `／${note.slice(0, 50)}` : "",
          ]
            .filter((t) => t.length > 0)
            .join("");

          if (line.length > 0) lines.push(line);
        });
      } catch {
        // items が無い・権限・インデックス未作成はスキップ
      }

      if (lines.length > 0) {
        blocks.push(`■ ${sectionTitle}\n${lines.join("\n")}`);
      }
    }

    const capped = blocks
      .join("\n")
      .split("\n")
      .slice(0, AI_SITE.limits.menuLines)
      .join("\n");
    return capped.length > 0 ? `【メニュー・料金（自動抽出）】\n${capped}` : "";
  } catch (e) {
    console.error("menu knowledge fetch error:", e);
    return "";
  }
}

async function getProductsKnowledgeFromFirestore(siteKey: string) {
  try {
    const itemsSnap = await adminDb
      .collection("siteProducts")
      .doc(siteKey)
      .collection("items")
      .orderBy("createdAt", "desc")
      .limit(AI_SITE.limits.productLines)
      .get();

    if (itemsSnap.empty) return "";

    const lines: string[] = [];
    itemsSnap.forEach((d) => {
      const it = d.data() as any;
      const name =
        (it?.titleI18n?.ja as string | undefined) ??
        (it?.title as string | undefined) ??
        "";
      const priceStr = pickPrice(it);
      const desc = String(
        (it?.base?.body as string | undefined) ??
          (it?.body as string | undefined) ??
          ""
      ).replace(/\s+/g, " ");
      const line = [
        name ? `- ${name}` : "",
        priceStr ? `：${priceStr}` : "",
        desc ? `／${desc.slice(0, 60)}` : "",
      ]
        .filter(Boolean)
        .join("");
      if (line) lines.push(line);
    });

    const body = lines
      .join("\n")
      .split("\n")
      .slice(0, AI_SITE.limits.productLines)
      .join("\n");
    return body ? `【商品一覧（自動抽出）】\n${body}` : "";
  } catch (e) {
    console.error("products knowledge fetch error:", e);
    return "";
  }
}

/* ================================
   営業時間（siteSettingsEditable/{siteKey}）を読み取り＆整形
================================ */
type HoursRow = {
  key?: string;
  day?: string;
  open?: string;
  close?: string;
  closed?: boolean;
};
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_JA: Record<string, string> = {
  mon: "月",
  tue: "火",
  wed: "水",
  thu: "木",
  fri: "金",
  sat: "土",
  sun: "日",
};
const DAY_EN: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

// 旧/新スキーマ両対応の正規化
function normalizeHours(bh: any): HoursRow[] {
  if (!bh) return [];

  // 新スキーマ: { tz, enabled, days: { mon:{ closed, ranges:[{start,end}] } } }
  if (bh.days && typeof bh.days === "object") {
    return DAY_ORDER.map((k) => {
      const d = bh.days?.[k] || {};
      const closed =
        !!d.closed || !Array.isArray(d.ranges) || d.ranges.length === 0;
      const r0 = Array.isArray(d.ranges) && d.ranges[0] ? d.ranges[0] : null;
      return {
        key: k,
        open: r0?.start ? String(r0.start).slice(0, 5) : "",
        close: r0?.end ? String(r0.end).slice(0, 5) : "",
        closed,
      };
    });
  }

  // 旧A: { hours: [{key:'mon', open, close, closed}, ...] }
  if (Array.isArray(bh.hours)) {
    return bh.hours
      .map((r: any) => ({
        key: (r?.key || r?.day || "").toString().toLowerCase(),
        open: (r?.open || "").toString(),
        close: (r?.close || "").toString(),
        closed: !!r?.closed,
      }))
      .filter((r: HoursRow) => !!r.key && DAY_ORDER.includes(r.key));
  }

  // 旧B: { weekly: { mon:{open,close,closed}, ... } }
  if (bh.weekly && typeof bh.weekly === "object") {
    return DAY_ORDER.map((k) => {
      const r = bh.weekly[k] || {};
      return {
        key: k,
        open: (r?.open || "").toString(),
        close: (r?.close || "").toString(),
        closed: !!r?.closed,
      };
    });
  }

  return [];
}

async function getBusinessHoursKnowledge(
  siteKey: string,
  uiLang: string
): Promise<{
  hasHours: boolean;
  knowledgeText: string;
  policyText: string;
  guardTextAvailable: string;
  guardTextUnavailable: string;
}> {
  try {
    const snap = await adminDb
      .collection("siteSettingsEditable")
      .doc(siteKey)
      .get();
    const data = (snap.data() as any) ?? {};
    const bh = data?.businessHours;

    const enabled = bh?.enabled !== false && !!bh;
    const rows = normalizeHours(bh);

    const notesJa =
      bh?.notesJa ?? bh?.noteJa ?? bh?.notes?.ja ?? bh?.notes ?? bh?.note ?? "";
    const notesEn =
      bh?.notesEn ?? bh?.noteEn ?? bh?.notes?.en ?? bh?.notes ?? bh?.note ?? "";

    let linesJa: string[] = [];
    let linesEn: string[] = [];
    const isNewSchema = bh?.days && typeof bh.days === "object";

    if (isNewSchema) {
      linesJa = DAY_ORDER.map((k) => {
        const d = bh.days?.[k] || {};
        if (d.closed) return `- ${DAY_JA[k]}：定休日`;
        const ranges = Array.isArray(d.ranges) ? d.ranges : [];
        if (!ranges.length) return `- ${DAY_JA[k]}：—`;
        const label = ranges
          .filter((r: any) => r?.start && r?.end)
          .map(
            (r: any) =>
              `${String(r.start).slice(0, 5)}〜${String(r.end).slice(0, 5)}`
          )
          .join("／");
        return `- ${DAY_JA[k]}：${label || "—"}`;
      });

      linesEn = DAY_ORDER.map((k) => {
        const d = bh.days?.[k] || {};
        if (d.closed) return `- ${DAY_EN[k]}: Closed`;
        const ranges = Array.isArray(d.ranges) ? d.ranges : [];
        if (!ranges.length) return `- ${DAY_EN[k]}: —`;
        const label = ranges
          .filter((r: any) => r?.start && r?.end)
          .map(
            (r: any) =>
              `${String(r.start).slice(0, 5)}–${String(r.end).slice(0, 5)}`
          )
          .join(" / ");
        return `- ${DAY_EN[k]}: ${label || "—"}`;
      });
    } else {
      linesJa = rows
        .sort((a, b) => DAY_ORDER.indexOf(a.key!) - DAY_ORDER.indexOf(b.key!))
        .map((r) => {
          const day = DAY_JA[r.key!];
          if (r.closed) return `- ${day}：定休日`;
          if (r.open && r.close) return `- ${day}：${r.open}〜${r.close}`;
          return `- ${day}：—`;
        });

      linesEn = rows
        .sort((a, b) => DAY_ORDER.indexOf(a.key!) - DAY_ORDER.indexOf(b.key!))
        .map((r) => {
          const day = DAY_EN[r.key!];
          if (r.closed) return `- ${day}: Closed`;
          if (r.open && r.close) return `- ${day}: ${r.open}–${r.close}`;
          return `- ${day}: —`;
        });
    }

    const hasHours =
      enabled &&
      (isNewSchema
        ? DAY_ORDER.some((k) => {
            const d = bh.days?.[k] || {};
            return (
              !!d.closed ||
              (Array.isArray(d.ranges) &&
                d.ranges.some((r: any) => r?.start && r?.end))
            );
          })
        : rows.some((r) => r.closed || (r.open && r.close)));

    if (!hasHours) {
      const policyText =
        uiLang === "ja"
          ? "【営業時間ポリシー】固定の営業時間は未設定。時間を尋ねられた場合は『固定の営業時間は設けていません。ご希望の日時をお知らせください。スタッフ確認のうえご案内します。』と答える。"
          : "Hours policy: No fixed business hours are configured. If asked about hours, say ‘No fixed hours; please share your preferred date/time and our staff will confirm.’";
      const guardTextUnavailable =
        uiLang === "ja"
          ? "【営業時間テンプレ（データなし）】ユーザーが営業時間を尋ねたら、一文目で『固定の営業時間は設けていません。ご希望の日時をお知らせください。』と回答。最後に『確定の場合は予約フォームからお願いいたします。』と一文添える。リンクは貼らない。"
          : "Hours template (no data): First sentence: ‘We don’t keep fixed hours. Please tell us your preferred date/time.’ End with ‘If you’d like to proceed, please use the booking form.’ No links.";
      return {
        hasHours: false,
        knowledgeText: "",
        policyText,
        guardTextAvailable: "",
        guardTextUnavailable,
      };
    }

    const blockJa = [
      "【営業時間（設定）】",
      ...linesJa,
      notesJa ? `※備考：${notesJa}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const blockEn = [
      "【Business Hours (configured)】",
      ...linesEn,
      notesEn ? `Note: ${notesEn}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const knowledgeText = uiLang === "ja" ? blockJa : blockEn;

    const policyText =
      uiLang === "ja"
        ? "【営業時間ポリシー】営業時間データが設定されています。時間について尋ねられた場合のみ、簡潔に案内する。空き状況の断定はしない。"
        : "Hours policy: Business hours are configured. Only when asked about hours, answer concisely. Do not assert availability.";

    const guardTextAvailable =
      uiLang === "ja"
        ? "【営業時間テンプレ（データあり）】ユーザーが営業時間を尋ねたら、一文目で簡潔に営業時間を回答（例：『平日9:00〜18:00、土曜10:00〜16:00、日曜は定休日です。』）。最後に『確定の場合は予約フォームからお願いいたします。』と一文添える。リンクは貼らない。"
        : "Hours template (with data): First sentence should concisely state hours (e.g., ‘Weekdays 9:00–18:00; Sat 10:00–16:00; Sun closed.’). End with ‘If you’d like to proceed, please use the booking form.’ No links.";

    return {
      hasHours: true,
      knowledgeText,
      policyText,
      guardTextAvailable,
      guardTextUnavailable: "",
    };
  } catch {
    const policyText =
      uiLang === "ja"
        ? "【営業時間ポリシー】固定の営業時間は未設定。時間を尋ねられた場合は『固定の営業時間は設けていません。ご希望の日時をお知らせください。スタッフ確認のうえご案内します。』と答える。"
        : "Hours policy: No fixed business hours are configured. If asked about hours, say ‘No fixed hours; please share your preferred date/time and our staff will confirm.’";
    const guardTextUnavailable =
      uiLang === "ja"
        ? "【営業時間テンプレ（データなし）】ユーザーが営業時間を尋ねたら、一文目で『固定の営業時間は設けていません。ご希望の日時をお知らせください。』と回答。最後に『確定の場合は予約フォームからお願いいたします。』と一文添える。リンクは貼らない。"
        : "Hours template (no data): First sentence: ‘We don’t keep fixed hours. Please tell us your preferred date/time.’ End with ‘If you’d like to proceed, please use the booking form.’ No links.";
    return {
      hasHours: false,
      knowledgeText: "",
      policyText,
      guardTextAvailable: "",
      guardTextUnavailable,
    };
  }
}

/* ================================
   意図検知ユーティリティ
================================ */
function looksLikeInventoryQuery(text: string): boolean {
  const t = (text || "").toLowerCase();
  return /在庫|入荷|売り切れ|品切れ|残り|在庫(確認|状況)|stock|sold\s*out/.test(
    t
  );
}

function looksLikeBookingIntent(text: string): boolean {
  const t = (text || "").toLowerCase();
  return /(依頼|お願い|予約|申し込|申込|頼みたい|お願いしたい|対応可能|空いてますか|希望日時|毎週|曜|[0-9]{1,2}\s*時)/.test(
    t
  );
}

function looksLikeServicePriceQuestion(text: string): boolean {
  const s = (text || "").toLowerCase();
  const price = /(いくら|料金|値段|費用|相場|価格|おいくら|金額|price)/.test(s);
  const service =
    /(掃除|清掃|クリーニング|配管|排水|配水|エアコン|ハウス|レンジフード|換気扇|浴室|風呂|トイレ|キッチン|水回り|作業|工事|修理|点検|見積)/.test(
      s
    );
  return price && service;
}

function looksLikePurchaseIntent(text: string): boolean {
  const t = (text || "").toLowerCase();
  return /(買いたい|購入|注文|取り寄せ|買えますか|購入できますか|カート|オンラインショップ|通販)/.test(
    t
  );
}

function looksLikeHoursQuery(text: string): boolean {
  const s = (text || "").toLowerCase();
  return /(営業時間|営業日|何時から|何時まで|open|opening hours|business hours|定休日)/.test(
    s
  );
}

// ★ おすすめ系（営業時間を出さないための専用ガード用）
function looksLikeRecommendation(text: string): boolean {
  const s = (text || "").toLowerCase();
  return /(おすすめ|オススメ|recommend(ed)?|どれが良い|なにが良い)/.test(s);
}

/* ================================
   在庫ツール（adminDb直読でサーバ内完結）
================================ */
async function getInventoryKnowledge(siteKey: string, userQuery: string) {
  try {
    const mod = await import("@/lib/inventory");
    let items = await mod.searchInventory(siteKey, userQuery, 10);

    if (!items.length) {
      const cleaned = String(userQuery || "")
        .replace(
          /在庫|ありますか|個|残り|個数|数量|品切れ|売り切れ|入荷|sold\s*out|stock/gi,
          ""
        )
        .trim();
      if (cleaned) items = await mod.searchInventory(siteKey, cleaned, 10);
    }
    if (!items.length) {
      const all = await mod.fetchInventory(siteKey);
      const prioritized = [
        ...all.filter((r) => r.status === "in_stock"),
        ...all.filter((r) => r.status === "low"),
        ...all.filter((r) => r.status === "out"),
        ...all.filter((r) => r.status === "unset"),
      ].slice(0, 10);
      items = prioritized;
    }

    const lines = inventoryPassages(items);
    if (!lines.length) return "";
    const stamp = new Date().toLocaleString("ja-JP");
    return `【在庫状況（自動取得 ${stamp}）】\n${lines.join("\n")}`;
  } catch (e) {
    console.warn("inventory knowledge fetch failed", e);
    return "";
  }
}

/* ================================
   Handler
================================ */
export async function POST(req: NextRequest) {
  try {
    const { message, siteKey, uiLang: rawUiLang } = await req.json();

    if (!message || !siteKey) {
      return NextResponse.json(
        { error: "message and siteKey are required" },
        { status: 400 }
      );
    }

    const uiLang =
      typeof rawUiLang === "string" &&
      AI_SITE.languages.allowed.includes(rawUiLang)
        ? rawUiLang
        : AI_SITE.languages.default;

    const langName =
      LANG_NAME[uiLang] ?? LANG_NAME[AI_SITE.languages.default] ?? "日本語";

    // ===== 意図判定（先に実施） =====
    const msgText = String(message);
    const isHoursQ = looksLikeHoursQuery(msgText);
    const isInventoryQ = looksLikeInventoryQuery(msgText);
    const isBooking = looksLikeBookingIntent(msgText);
    const isServicePrice = looksLikeServicePriceQuestion(msgText);
    const isPurchase = looksLikePurchaseIntent(msgText);
    const isRecommend = looksLikeRecommendation(msgText);

    // 1) ナレッジ取得
    const baseDoc = adminDb.collection("aiKnowledge").doc("base");
    const ownerDoc = adminDb
      .collection("aiKnowledge")
      .doc(siteKey)
      .collection("docs")
      .doc("owner");
    const learnDoc = adminDb
      .collection("aiKnowledge")
      .doc(siteKey)
      .collection("docs")
      .doc("learned");

    const [baseItems, ownerItems, learnedItems, keywordsText, ownerPrompt] =
      await Promise.all([
        getItems(baseDoc),
        getItems(ownerDoc),
        getItems(learnDoc),
        getKeywordsKnowledge(siteKey),
        getOwnerPrompt(siteKey),
      ]);

    const staticKnowledge = [
      qaToText("共通知識", baseItems, AI_SITE.limits.qaBase),
      qaToText("店舗固有知識", ownerItems, AI_SITE.limits.qaOwner),
      qaToText("学習知識", learnedItems, AI_SITE.limits.qaLearned),
      keywordsText,
    ]
      .filter((t) => t && t.length > 0)
      .join("\n\n");

    // 2) 動的抽出
    const [menuText, productsText] = await Promise.all([
      getMenuKnowledgeFromFirestore(siteKey),
      AI_SITE.retail
        ? getProductsKnowledgeFromFirestore(siteKey)
        : Promise.resolve(""),
    ]);

    // 3) 営業時間（Firestore）
    const {
      hasHours,
      knowledgeText: hoursKnowledge,
      policyText: hoursPolicyDynamic,
      guardTextAvailable,
      guardTextUnavailable,
    } = await getBusinessHoursKnowledge(siteKey, uiLang);

    // 4) KB（RAG）
    const kbHits = await retrieveKB({
      question: msgText,
      topK: 5,
      minScore: 0.35,
      siteKey,
    });
    const kbText = kbHits.length
      ? `【KB（RAG）】\n${hitsToPassages(kbHits).join("\n\n")}`
      : "";

    // 5) 在庫（必要時のみ）
    const inventoryText = isInventoryQ
      ? await getInventoryKnowledge(siteKey, msgText)
      : "";

    // 6) 参照知識の構成（意図に応じて注入）
    const knowledgeParts: string[] = [];

    // 営業時間は聞かれた時だけ前方に
    if (isHoursQ && hoursKnowledge) knowledgeParts.push(hoursKnowledge);

    // 在庫は在庫質問時のみ
    if (isInventoryQ && inventoryText) knowledgeParts.push(inventoryText);

    // その他は汎用として後方
    if (staticKnowledge) knowledgeParts.push(staticKnowledge);
    if (menuText) knowledgeParts.push(menuText);
    if (productsText) knowledgeParts.push(productsText);
    if (kbText) knowledgeParts.push(kbText);

    const allKnowledge = knowledgeParts.join("\n\n");

    // 7) System（方針）
    const areas = AI_SITE.areasByLang[uiLang] ?? AI_SITE.areasByLang.en ?? "";
    const services = (
      AI_SITE.servicesByLang[uiLang] ??
      AI_SITE.servicesByLang.en ??
      []
    ).join(uiLang === "ja" ? "／" : " / ");

    const header =
      uiLang === "ja"
        ? `あなたは「${AI_SITE.brand}」${
            AI_SITE.url ? `（${AI_SITE.url}）` : ""
          } 専属のサポートAIです。対象は **${areas}** のお客様。主なサービス：**${services}**。サイトID: ${siteKey}。`
        : `You are the dedicated support AI for “${AI_SITE.brand}”${
            AI_SITE.url ? ` (${AI_SITE.url})` : ""
          }. Main service area: **${areas}**. Services: **${services}**. Site ID: ${siteKey}.`;

    const scope = t("scopeIntro", uiLang);
    const restrict = t("restrict", uiLang);
    const tone = t("tone", uiLang);
    const priceDisclaimer = t("priceDisclaimer", uiLang);
    const productAdvice = AI_SITE.retail ? t("productPriceAdvice", uiLang) : "";

    const styleBullets = (t("styleBullets", uiLang) as string[]).join(
      uiLang === "ja" ? "\n- " : "\n- "
    );

    const retailRule = AI_SITE.retail
      ? uiLang === "ja"
        ? "商品についての質問は、参照知識の範囲で簡潔に回答。十分な情報が無い場合や価格を確定できない場合は、最後に「商品一覧ページをご確認ください。」と案内（リンクは貼らない）。"
        : "For product questions, answer briefly if knowledge exists; if insufficient or if the price cannot be confirmed, end with “Please check the Products page.” (no link)."
      : "";

    const languageLock =
      uiLang === "ja"
        ? `【重要】回答は常に **${langName}**（${uiLang}）で行ってください。混在させないでください。`
        : `Important: Respond **only in ${langName}** (${uiLang}). Do not mix languages.`;

    // 意図フラグを明示（モデルへ強制）
    const flags =
      uiLang === "ja"
        ? `【意図フラグ】HOURS=${isHoursQ ? 1 : 0} INVENTORY=${
            isInventoryQ ? 1 : 0
          } PURCHASE=${isPurchase ? 1 : 0} BOOKING=${
            isBooking ? 1 : 0
          } PRICE=${isServicePrice ? 1 : 0} RECOMMEND=${isRecommend ? 1 : 0}`
        : `INTENTS HOURS=${isHoursQ ? 1 : 0} INVENTORY=${
            isInventoryQ ? 1 : 0
          } PURCHASE=${isPurchase ? 1 : 0} BOOKING=${
            isBooking ? 1 : 0
          } PRICE=${isServicePrice ? 1 : 0} RECOMMEND=${isRecommend ? 1 : 0}`;

    // オーナー追加方針
    const ownerBlock = [
      ownerPrompt.system
        ? uiLang === "ja"
          ? `【オーナー方針】\n${ownerPrompt.system}`
          : `Owner Directives:\n${ownerPrompt.system}`
        : "",
      ownerPrompt.styleBullets?.length
        ? uiLang === "ja"
          ? `【追加スタイル】\n- ${ownerPrompt.styleBullets.join("\n- ")}`
          : `Extra Style:\n- ${ownerPrompt.styleBullets.join("\n- ")}`
        : "",
      ownerPrompt.disclaimers?.length
        ? uiLang === "ja"
          ? `【注意書き】\n- ${ownerPrompt.disclaimers.join("\n- ")}`
          : `Disclaimers:\n- ${ownerPrompt.disclaimers.join("\n- ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // 営業時間ポリシー（動的）
    const hoursPolicy = hoursPolicyDynamic;

    const bookingPolicy =
      uiLang === "ja"
        ? "【予約ポリシー】依頼・予約希望・希望日時の提示があった場合は、確定の可否を即答せず、「ご依頼の場合は予約フォームに入力してください。送信後にスタッフが可否を確認してご連絡します。」と案内する。フォームは名称のみで示し、リンクは貼らない。"
        : "Booking policy: If the user requests a service or provides a preferred date/time, do not confirm availability. Instruct them to complete the booking form and explain staff will confirm after submission. Refer to the form by name only (no links).";

    const purchasePolicy =
      uiLang === "ja"
        ? "【購入ポリシー】購入意図がある場合でも、**冒頭で購入誘導を書かないこと**。まずユーザーの質問（価格・仕様 等）に簡潔に回答し、必要なら在庫/支払い/配送の一般的な補足を1〜2文。**最後の一文のみ**『オンラインショップからご購入ください。』と案内する（リンクは貼らない）。"
        : "Purchase policy: Even with purchase intent, **do not start with a shop CTA**. First answer the user’s question (price/specs) concisely, optionally add 1–2 general notes about stock/payment/shipping, then **only in the final sentence** say “Please purchase via our online shop.” (no links).";

    // ★ 焦点化ルール & トピック禁止（自然な回答のための強制）
    const focusRule =
      uiLang === "ja"
        ? [
            "【焦点化ルール】ユーザーの質問に直接必要な情報のみを使って回答する。最初の一文は端的に答える。必要なら1〜3文で補足。無関係な話題は出さない。",
            "【トピック禁止】HOURS=0 のときは営業時間・定休日・何時〜何時を一切述べない。INVENTORY=0 のときは在庫状況を述べない。RECOMMEND=1 のときは営業時間を出さない。",
          ].join("\n")
        : [
            "Focus rule: Use only info directly needed for the user’s question. First sentence answers succinctly; add up to 1–3 short supporting sentences. Do not add unrelated topics.",
            "Topic bans: When HOURS=0 do NOT mention business hours; when INVENTORY=0 do NOT mention stock; when RECOMMEND=1 do NOT mention hours.",
          ].join("\n");

    const systemPolicy = [
      header,
      languageLock,
      flags,
      ownerBlock,
      hoursPolicy,
      bookingPolicy,
      purchasePolicy,
      focusRule,
      uiLang === "ja" ? `【対応範囲】\n- ${scope}` : `Scope:\n- ${scope}`,
      uiLang === "ja"
        ? `【禁止・制約】\n- ${restrict}`
        : `Restrictions:\n- ${restrict}`,
      uiLang === "ja"
        ? `【返答スタイル】\n- ${tone}\n- ${styleBullets}\n- 価格提示時は「目安：¥xx,xxx（税込）」形式とし、最後に「${priceDisclaimer}」を添えてください。`
        : `Style:\n- ${tone}\n- ${styleBullets}\n- When quoting prices, use “Approx: ¥xx,xxx (tax incl.)” and append: “${priceDisclaimer}”.`,
      retailRule,
      AI_SITE.retail ? productAdvice : "",
      allKnowledge
        ? uiLang === "ja"
          ? "以下の参照知識を必要に応じて活用してください。無関係な内容は出さないこと。"
          : "Use the following reference knowledge as needed. Do not include unrelated content."
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // ★ テンプレ群（必要時のみ注入）
    const bookingGuard =
      uiLang === "ja"
        ? "【予約誘導テンプレ】ユーザーが依頼/予約の意図を示した場合は、必ず一文目に次の固定文を出力する:「ご依頼の場合は予約フォームに入力してください。送信後にスタッフが可否を確認してご連絡します。」その後は1〜2文で希望日時や作業内容の記入を促すのみ。空き状況を断定しない。リンクは貼らない。"
        : "Booking guard: If the user shows booking intent, the very first sentence MUST be: “Please fill out the booking form. Our staff will confirm availability after submission.” Then add 1–2 short prompts for date/time and details. Do not claim availability. No links.";

    const purchaseGuard =
      uiLang === "ja"
        ? "【購入誘導テンプレ】購入意図がある場合は、(1) 質問に簡潔に回答 → (2) 支払い・配送・在庫の一般案内を1〜2文 → (3) **最後の一文**で『オンラインショップからご購入ください。』を出力する。冒頭で購入誘導は出さない。リンクは貼らない。"
        : "Purchase guard: With purchase intent: (1) answer the question briefly → (2) add 1–2 general notes (payment/shipping/stock) → (3) **in the final sentence** output “Please purchase via our online shop.” Do not start with the CTA. No links.";

    const servicePriceGuard =
      uiLang === "ja"
        ? "【価格回答テンプレ（サービス）】価格/費用を尋ねられたら、まず一文目で目安価格を提示（例『目安：¥xx,xxx（税込）です。』）。次に現地状況で変動する旨を一文。最後に『確定の場合は予約フォームからお願いいたします。』。"
        : "Service price guard: First sentence gives an approximate price; then note it may vary on-site; end with “If you’d like to proceed, please use the booking form.”";

    const hoursGuardAvailable = guardTextAvailable || "";
    const hoursGuardUnavailable = guardTextUnavailable || "";

    type ChatMsg = OpenAI.Chat.Completions.ChatCompletionMessageParam;
    const messages: ChatMsg[] = [{ role: "system", content: systemPolicy }];

    // 意図に応じてガードを追加（順序重要）
    if (isBooking) messages.push({ role: "system", content: bookingGuard });
    if (isServicePrice) messages.push({ role: "system", content: servicePriceGuard });
    if (isPurchase) messages.push({ role: "system", content: purchaseGuard });
    if (isHoursQ) {
      messages.push({
        role: "system",
        content: hasHours ? hoursGuardAvailable : hoursGuardUnavailable,
      });
    }

    if (allKnowledge.length > 0)
      messages.push({ role: "system", content: allKnowledge });

    messages.push({ role: "user", content: msgText });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
    });

    const answer =
      completion.choices[0]?.message?.content?.trim() ??
      (uiLang === "ja"
        ? "すみません、うまく回答できませんでした。"
        : "Sorry, I couldn’t generate a proper answer.");

    const inventoryLines = (inventoryText.match(/\n-/g) || []).length;

    await adminDb.collection("aiChatLogs").add({
      siteKey,
      message: msgText,
      uiLang,
      answer,
      kbHitCount: kbHits.length,
      kbTop: kbHits.slice(0, 3).map((h) => ({
        id: h.id,
        score: Number(h.score.toFixed(4)),
        vec: Number(h.scores.vec.toFixed(4)),
        lex: Number(h.scores.lex.toFixed(4)),
      })),
      inventoryEnabled: isInventoryQ,
      inventoryLines,
      createdAt: new Date(),
    });

    const needsHuman =
      /担当.?者に確認します|分かりません|確認の上ご案内|check with (?:the )?staff|confirm with (?:our )?staff|I(?:'| wi)ll confirm|I don't know/i.test(
        answer
      );
    if (needsHuman) {
      try {
        const baseUrl = resolveBaseUrl(req);
        await fetch(`${baseUrl}/api/ai-notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteKey, question: msgText }),
        });
      } catch (e) {
        console.error("AI notify error:", e);
      }
    }

    return NextResponse.json({ answer });
  } catch (err: any) {
    console.error("AI chat error", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
