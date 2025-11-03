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

function ymdToTs(ymd: string, endOfDay = false) {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
  return Timestamp.fromDate(date);
}

async function pagesTotals(start: string, end: string) {
  const s = ymdToTs(start, false);
  const e = ymdToTs(end, true);
  const snap = await getDocs(
    query(
      collection(db, "analytics", SITE_KEY, "pagesDaily"),
      where("day", ">=", s),
      where("day", "<=", e)
    )
  );
  const totals: Record<string, number> = {};
  snap.forEach((d) => {
    const { pageId, count = 0 } = d.data() as {
      pageId: string;
      count?: number;
    };
    if (!pageId) return;
    totals[pageId] =
      (totals[pageId] || 0) + (typeof count === "number" ? count : 0);
  });
  // 除外を落として返す
  const filtered: Record<string, number> = {};
  Object.entries(totals).forEach(([k, v]) => {
    if (!EXCLUDED.has(k)) filtered[k] = v;
  });
  return filtered;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start"); // YYYY-MM-DD
  const end = searchParams.get("end"); // YYYY-MM-DD
  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end are required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }
  const totals = await pagesTotals(start, end);
  return NextResponse.json({ start, end, totals });
}
