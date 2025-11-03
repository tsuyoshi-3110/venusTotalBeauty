// src/app/api/probe-detail/route.ts
import { NextResponse } from "next/server";
import {
  getDocs,
  collection,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

const EXCLUDED = new Set(["login", "analytics", "community", "postList"]);

const range = (
  y1: number,
  m1: number,
  d1: number,
  y2: number,
  m2: number,
  d2: number
) => ({
  s: Timestamp.fromDate(new Date(y1, m1 - 1, d1, 0, 0, 0, 0)),
  e: Timestamp.fromDate(new Date(y2, m2 - 1, d2, 23, 59, 59, 999)),
});

async function pagesTotals(r: { s: Timestamp; e: Timestamp }) {
  const snap = await getDocs(
    query(
      collection(db, "analytics", SITE_KEY, "pagesDaily"),
      where("day", ">=", r.s),
      where("day", "<=", r.e)
    )
  );
  const totals: Record<string, number> = {};
  snap.forEach((d) => {
    const { pageId, count = 0 } = d.data() as {
      pageId: string;
      count?: number;
    };
    if (!pageId) return;
    totals[pageId] = (totals[pageId] || 0) + count;
  });
  return totals;
}

export async function GET() {
  // 直近7日と30日の比較（必要なら日付調整）
  const now = new Date();
  const r7 = range(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate() - 6, // 今日含め7日間
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  );
  const r30 = range(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate() - 29, // 30日間
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  );

  const [t7, t30] = await Promise.all([pagesTotals(r7), pagesTotals(r30)]);

  // 差分を作る（除外ページは落とす）
  const allKeys = new Set<string>([...Object.keys(t7), ...Object.keys(t30)]);
  const diff: Array<{ page: string; w7: number; w30: number; delta: number }> =
    [];
  allKeys.forEach((k) => {
    if (EXCLUDED.has(k)) return;
    const a = t7[k] || 0;
    const b = t30[k] || 0;
    if (a !== b) diff.push({ page: k, w7: a, w30: b, delta: b - a });
  });

  return NextResponse.json({ totals7: t7, totals30: t30, diff });
}
