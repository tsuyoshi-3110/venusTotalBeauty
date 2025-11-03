// src/app/api/probe/route.ts
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

async function probeDaily(colName: string, r: { s: Timestamp; e: Timestamp }) {
  const snap = await getDocs(
    query(
      collection(db, "analytics", SITE_KEY, colName),
      where("day", ">=", r.s),
      where("day", "<=", r.e)
    )
  );
  return snap.size;
}

export async function GET() {
  // 例: 直近7日 vs 直近30日
  const r7 = range(2025, 9, 1, 2025, 9, 7);
  const r30 = range(2025, 8, 9, 2025, 9, 7);

  const pages7 = await probeDaily("pagesDaily", r7);
  const pages30 = await probeDaily("pagesDaily", r30);

  return NextResponse.json({ pages7, pages30 });
}
