// src/lib/inventory.ts
// 役割: 在庫（/stock ＆ /siteProducts/{siteKey}/items）を検索し、AIに渡す短文パッセージを生成
// 依存: adminDb（Firebase Admin）

import { adminDb } from "@/lib/firebase-admin";

export type InventoryRow = {
  productId: string;
  sku?: string;
  name: string;
  stockQty: number;
  lowStockThreshold: number;
  updatedAt?: any;
  status: "in_stock" | "low" | "out" | "unset";
  score?: number;
};

const toTs = (ts?: any): number => {
  if (!ts) return 0;
  try {
    if (typeof ts?.toDate === "function") return ts.toDate().getTime();
    const d = new Date(ts);
    return Number.isFinite(d.getTime()) ? d.getTime() : 0;
  } catch {
    return 0;
  }
};

// ===== 文字処理（日本語向け簡易） =====
function normalizeJa(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[\u3000\s]+/g, " ")
    // 記号類を削る（Unicode プロパティ利用）
    .replace(/[\p{P}\p{S}]/gu, "");
}

function ngrams(str: string, n = 2): string[] {
  const s = normalizeJa(str).replace(/\s+/g, "");
  if (!s) return [];
  const out: string[] = [];
  for (let i = 0; i <= s.length - n; i++) out.push(s.slice(i, i + n));
  return out.length ? out : [s];
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const uni = sa.size + sb.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

// ===== Firestore から在庫 + 商品名を取得 =====
export async function fetchInventory(siteKey: string): Promise<InventoryRow[]> {
  // stock コレクション
  const stockSnap = await adminDb
    .collection("stock")
    .where("siteKey", "==", siteKey)
    .get();

  const byPid: Record<
    string,
    Omit<InventoryRow, "name" | "status"> & { name?: string; status?: InventoryRow["status"] }
  > = {};

  stockSnap.forEach((d) => {
    const s = d.data() as any;
    const qty = Number(s.stockQty ?? 0) || 0;
    const th = Number(s.lowStockThreshold ?? 0) || 0;
    let status: InventoryRow["status"] = "unset";
    if (qty <= 0) status = "out";
    else if (qty <= th) status = "low";
    else status = "in_stock";
    byPid[String(s.productId)] = {
      productId: String(s.productId),
      sku: typeof s.sku === "string" ? s.sku : undefined,
      stockQty: qty,
      lowStockThreshold: th,
      updatedAt: s.updatedAt,
      status,
    };
  });

  // product 名称解決（siteProducts/{siteKey}/items）
  const prodSnap = await adminDb
    .collection("siteProducts")
    .doc(siteKey)
    .collection("items")
    .get();

  prodSnap.forEach((d) => {
    const p = d.data() as any;
    const pid = String(p.productId || d.id);
    const name = String(p?.titleI18n?.ja || p?.title || p?.base?.title || "").trim();
    if (!byPid[pid]) {
      // 在庫未設定のアイテムも行に出す（status = unset）
      byPid[pid] = {
        productId: pid,
        sku: undefined,
        stockQty: 0,
        lowStockThreshold: 0,
        updatedAt: p.updatedAt,
        status: "unset",
        name,
      } as any;
    } else {
      byPid[pid].name = name;
    }
  });

  const rows: InventoryRow[] = Object.values(byPid).map((r) => ({
    productId: r.productId,
    sku: r.sku,
    name: r.name || "(名称未設定)",
    stockQty: r.stockQty,
    lowStockThreshold: r.lowStockThreshold,
    updatedAt: r.updatedAt,
    status: (r.status as InventoryRow["status"]) || "unset",
  }));

  // 名前が無いものは末尾に
  rows.sort((a, b) => (a.name && !b.name ? -1 : !a.name && b.name ? 1 : 0));
  return rows;
}

// ===== クエリに対する検索 =====
export async function searchInventory(
  siteKey: string,
  query: string,
  topN = 10
): Promise<InventoryRow[]> {
  const rows = await fetchInventory(siteKey);
  const qn = ngrams(String(query || ""), 2);
  const scored = rows.map((r) => ({
    ...r,
    score:
      0.7 * jaccard(qn, ngrams(r.name, 2)) +
      0.3 * jaccard(qn, ngrams(r.sku || r.productId, 2)),
  }));
  scored.sort((a, b) => (b.score! - a.score!));
  return scored.slice(0, topN);
}

// ===== AI用の短いパッセージへ（一般消費者向けに最適化） =====
export function inventoryPassages(
  items: InventoryRow[],
  opts?: {
    audience?: "consumer" | "staff";   // 出力対象：デフォルト consumer（一般客）
    smallCountCap?: number;            // 何点以下なら具体数を出すか（既定 5）
    showExactCountOnInStock?: boolean; // 在庫十分でも数を出す（既定 false）
    includeTimestamp?: boolean;        // 最終更新の表示（既定 true）
  }
): string[] {
  const audience = opts?.audience ?? "consumer";
  const cap = Number.isFinite(opts?.smallCountCap) ? (opts!.smallCountCap as number) : 5;
  const showExactOnPlenty = !!opts?.showExactCountOnInStock;
  const includeTs = opts?.includeTimestamp ?? true;

  const label = (r: InventoryRow) => {
    switch (r.status) {
      case "out":
        return "在庫なし";
      case "low":
        return "残りわずか";
      case "in_stock":
        return "在庫あり";
      default:
        return "在庫情報の確認が必要";
    }
  };

  const fmtCount = (qty: number, status: InventoryRow["status"]) => {
    if (audience === "staff") return `（在庫${qty}）`;
    if (status === "low" && qty > 0) return qty <= cap ? `（あと${qty}点）` : "（残りわずか）";
    if (status === "in_stock" && showExactOnPlenty && qty <= cap) return `（約${qty}点）`;
    return "";
  };

  const extraStaff = (r: InventoryRow) =>
    audience === "staff" ? `／しきい値${r.lowStockThreshold}` : "";

  const when = (r: InventoryRow) => {
    if (!includeTs) return "";
    const ms = toTs(r.updatedAt);
    return ms ? new Date(ms).toLocaleString("ja-JP") : "";
  };

  return items.map((r) => {
    const name = r.name || "(名称未設定)";
    const sku = r.sku ? `（${r.sku}）` : "";
    const lbl = label(r);
    const ts = when(r);

    if (audience === "consumer") {
      // consumer: しきい値は出さず、読みやすい自然文
      // 例）- 洗濯洗剤（P0003）：残りわずか（あと2点）（最終更新: 2025/10/28 13:10）
      return `- ${name}${sku}：${lbl}${fmtCount(r.stockQty, r.status)}${
        ts ? `（最終更新: ${ts}）` : ""
      }`;
    }

    // staff: 数字＋しきい値も表示
    return `- ${name}${sku}：${lbl}（在庫${r.stockQty}${extraStaff(r)}${
      ts ? `、最終更新: ${ts}` : ""
    }）`;
  });
}
