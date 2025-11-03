// src/components/hours/HoursSection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { doc, onSnapshot } from "firebase/firestore";
import clsx from "clsx";

/** Firestore 保存スキーマ（BusinessHoursCard に一致） */
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type TimeRange = { start: string; end: string };
type DayHours = { closed?: boolean; ranges?: TimeRange[] };
type BusinessHours = {
  enabled?: boolean;
  tz?: string;
  days?: Partial<Record<DayKey, DayHours>>;
  notes?: string;
  note?: string; // 互換
};

const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_JA: Record<DayKey, string> = {
  mon: "月",
  tue: "火",
  wed: "水",
  thu: "木",
  fri: "金",
  sat: "土",
  sun: "日",
};

function nowInTZ(tz?: string) {
  const timeZone = tz || "Asia/Tokyo";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());

  const wd = (parts.find((p) => p.type === "weekday")?.value || "Mon").slice(
    0,
    3
  );
  const h = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);

  const map: Record<string, DayKey> = {
    Sun: "sun",
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
  };
  return { dayKey: map[wd] ?? "mon", minutes: h * 60 + m };
}

function toMinutes(t?: string): number | null {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isOpenNowInRanges(minsNow: number, d?: DayHours | null) {
  if (!d || d.closed) return false;
  const ranges = d.ranges || [];
  return ranges.some((r) => {
    const o = toMinutes(r.start);
    const c = toMinutes(r.end);
    return o != null && c != null && o <= minsNow && minsNow < c;
  });
}

function rangesLabel(d?: DayHours | null) {
  if (!d || d.closed) return "休業";
  const ranges = (d.ranges || []).filter((r) => r.start && r.end);
  if (!ranges.length) return "休業";
  return ranges.map((r) => `${r.start}〜${r.end}`).join("／");
}

export default function HoursSection() {
  const [bh, setBh] = useState<BusinessHours | null>(null);
  const [loading, setLoading] = useState(true);

  // Firestore 購読
  useEffect(() => {
    const ref = doc(db, "siteSettingsEditable", SITE_KEY);
    return onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as any) || {};
        setBh((data.businessHours as BusinessHours) || null);
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, []);

  // 1分おきに再描画
  const [, forceRender] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceRender((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const tz = bh?.tz || "Asia/Tokyo";
  const { dayKey: todayKey, minutes: nowMins } = nowInTZ(tz);
  const todayDay = bh?.days?.[todayKey] ?? null;
  const openNow = useMemo(
    () => isOpenNowInRanges(nowMins, todayDay),
    [nowMins, todayDay]
  );

  const todayMessage = useMemo(() => {
    if (!bh?.enabled) return "固定の営業時間は設定されていません。";
    if (
      !todayDay ||
      todayDay.closed ||
      !(todayDay.ranges && todayDay.ranges.length)
    )
      return "本日は休業です。";
    const first = todayDay.ranges[0];
    if (!first?.start || !first?.end) return "本日の営業時間は未設定です。";
    return openNow
      ? `本日は営業中（${first.start} - ${first.end}）`
      : `本日の営業時間（${first.start} - ${first.end}）`;
  }, [bh?.enabled, todayDay, openNow]);

  const weeklyRows = useMemo(() => {
    const days = bh?.days || {};
    return DAY_ORDER.map((k) => {
      const d = days[k];
      const closed = d?.closed || !(d?.ranges && d.ranges.length);
      return { key: k, label: DAY_JA[k], closed, text: rangesLabel(d) };
    });
  }, [bh?.days]);

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 text-neutral-900">
      <h1 className="text-3xl font-extrabold tracking-tight mb-4 text-white text-outline">
        営業時間
      </h1>
      <h2 className="sr-only ">営業時間</h2>

      {loading || !bh?.enabled ? (
        <div className="rounded-2xl shadow-xl ring-1 ring-black/10 bg-white p-6">
          {loading ? "読み込み中…" : "現在、固定の営業時間は設定していません。"}
        </div>
      ) : (
        <>
          {/* 本日情報カード：不透明な白系で固定 */}
          <div
            className={clsx(
              "rounded-2xl shadow-xl ring-1 ring-black/10 p-5 mb-6",
              openNow ? "bg-green-300/30" : "bg-white"
            )}
          >
            <p className="text-lg font-semibold">{todayMessage}</p>
            {(bh?.notes || bh?.note) && (
              <p className="text-sm text-neutral-700 mt-1">
                {bh.notes || bh.note}
              </p>
            )}
          </div>

          {/* 週間テーブル：背景は純白、文字色も明示 */}
          <div className="overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/10 bg-white/50">
            <table className="w-full text-sm text-neutral-900">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="text-left px-4 py-3 w-24">曜日</th>
                  <th className="text-left px-4 py-3">営業時間</th>
                </tr>
              </thead>
              <tbody>
                {weeklyRows.map((r) => {
                  const isToday = r.key === todayKey;
                  return (
                    <tr
                      key={r.key}
                      className={clsx("border-t", isToday && "bg-blue-50/60")}
                    >
                      <td className="px-4 py-3 font-semibold">
                        {r.label}
                        {isToday && (
                          <span className="ml-2 text-xs rounded bg-blue-600 text-white px-1.5 py-0.5">
                            本日
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.closed ? (
                          <span className="text-neutral-700">休業</span>
                        ) : (
                          <span className="font-medium">{r.text}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-white text-outline mt-6">
            ※
            営業時間は目安です。状況により前後することがあります。確定のご依頼は予約フォームからお願いいたします。
          </p>
        </>
      )}
    </section>
  );
}
