// src/app/tokushoho/page.tsx
"use client";

import Head from "next/head";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

type OwnerSettings = {
  siteName?: string;
  ownerName?: string;
  ownerAddress?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  businessHours?: string; // 任意: 受付時間
};

type RefundPolicy = {
  windowDays?: number;
};

type ShippingPolicy = {
  leadTimeMinDays?: number;
  leadTimeMaxDays?: number;
  // 互換フィールド名も一応見る
  shipLeadMinDays?: number;
  shipLeadMaxDays?: number;
};

export default function TokuShohoPage() {
  const [s, setS] = useState<OwnerSettings>({});
  const [windowDays, setWindowDays] = useState<number | null>(null);
  const [leadMin, setLeadMin] = useState<number | null>(null);
  const [leadMax, setLeadMax] = useState<number | null>(null);

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";
  const canonical = APP_URL ? `${APP_URL}/tokushoho` : "/tokushoho";

  useEffect(() => {
    (async () => {
      try {
        // オーナー情報
        const settingsRef = doc(db, "siteSettings", SITE_KEY);
        const settingsSnap = await getDoc(settingsRef);
        const d = (settingsSnap.data() as any) || {};
        setS({
          siteName: d?.siteName ?? "",
          ownerName: d?.ownerName ?? "",
          ownerAddress: d?.ownerAddress ?? "",
          ownerEmail: d?.ownerEmail ?? "",
          ownerPhone: d?.ownerPhone ?? "",
          businessHours: d?.businessHours ?? "",
        });

        // 返金ポリシー（日数）
        // 既定のパス: sites/{SITE_KEY}/policies/refund
        let wDays: number | undefined;
        try {
          const refundRef = doc(db, "sites", SITE_KEY, "policies", "refund");
          const refundSnap = await getDoc(refundRef);
          if (refundSnap.exists()) {
            const rp = refundSnap.data() as RefundPolicy;
            if (typeof rp?.windowDays === "number") wDays = rp.windowDays;
          }
        } catch {}
        // フォールバック（任意: 上位に policies がある構成を許容）
        if (wDays === undefined) {
          try {
            const refundAltRef = doc(db, "policies", SITE_KEY, "refund", "refund");
            const refundAltSnap = await getDoc(refundAltRef);
            if (refundAltSnap.exists()) {
              const rp = refundAltSnap.data() as RefundPolicy;
              if (typeof rp?.windowDays === "number") wDays = rp.windowDays;
            }
          } catch {}
        }
        setWindowDays(typeof wDays === "number" ? wDays : null);

        // 出荷目安（日数）: siteShippingPolicy/{SITE_KEY}
        try {
          const shipRef = doc(db, "siteShippingPolicy", SITE_KEY);
          const shipSnap = await getDoc(shipRef);
          if (shipSnap.exists()) {
            const sp = shipSnap.data() as ShippingPolicy;
            const min =
              typeof sp.leadTimeMinDays === "number"
                ? sp.leadTimeMinDays
                : typeof sp.shipLeadMinDays === "number"
                ? sp.shipLeadMinDays
                : null;
            const max =
              typeof sp.leadTimeMaxDays === "number"
                ? sp.leadTimeMaxDays
                : typeof sp.shipLeadMaxDays === "number"
                ? sp.shipLeadMaxDays
                : null;
            setLeadMin(min);
            setLeadMax(max);
          }
        } catch {
          // 取れなければ後でフォールバック
        }
      } catch (e) {
        console.warn("tokushoho load error", e);
      }
    })();
  }, []);

  const today = new Date();
  const ymd = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  // 表示用の文面を動的生成
  const shipText = (() => {
    const min = leadMin ?? 2;
    const max = leadMax ?? 5;
    if (leadMin != null && leadMax == null) return `通常、ご注文確定後${min}営業日以内に出荷します（予約・受注生産品を除く）。国際配送は通関等により遅延する場合があります。`;
    if (leadMin == null && leadMax != null) return `通常、ご注文確定後〜${max}営業日以内に出荷します（予約・受注生産品を除く）。国際配送は通関等により遅延する場合があります。`;
    return `通常、ご注文確定後${min}〜${max}営業日以内に出荷します（予約・受注生産品を除く）。国際配送は通関等により遅延する場合があります。`;
  })();

  const defectDaysText =
    typeof windowDays === "number" && windowDays > 0
      ? `到着後${windowDays}日以内にご連絡ください。状態確認のうえ、交換または返金にて対応します。`
      : "到着後速やかにご連絡ください。状態確認のうえ、交換または返金にて対応します。";

  return (
    <>
      <Head>
        <title>特定商取引法に基づく表記｜{s.siteName || "オンラインストア"}</title>
        <meta
          name="description"
          content={`${s.siteName || "本ストア"}の特定商取引法に基づく表記です。販売業者、所在地、連絡先、返品・支払方法等を掲載しています。`}
        />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={`特定商取引法に基づく表記｜${s.siteName || "オンラインストア"}`} />
        <meta property="og:description" content="販売業者情報や返品・支払方法等のご案内" />
        <meta property="og:type" content="article" />
      </Head>

      <main className="min-h-screen bg-white/50">
        <section className="max-w-3xl mx-auto px-4 py-10">
          <h1 className="text-2xl font-bold mb-6">特定商取引法に基づく表記</h1>
          <p className="text-sm text-gray-500 mb-8">最終更新日：{ymd}</p>

          <div className="space-y-6 text-[15px]">
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2">
              <dt className="font-semibold">販売業者</dt>
              <dd className="sm:col-span-2">{s.siteName || "—"}</dd>

              <dt className="font-semibold">運営責任者</dt>
              <dd className="sm:col-span-2">{s.ownerName || "—"}</dd>

              <dt className="font-semibold">所在地</dt>
              <dd className="sm:col-span-2 whitespace-pre-wrap">{s.ownerAddress || "—"}</dd>

              <dt className="font-semibold">連絡先</dt>
              <dd className="sm:col-span-2">
                {s.ownerEmail || "—"} / {s.ownerPhone || "—"}
                {s.businessHours && <span className="text-gray-500">（受付時間：{s.businessHours}）</span>}
              </dd>

              <dt className="font-semibold">販売価格</dt>
              <dd className="sm:col-span-2">各商品ページに税込価格を表示します。</dd>

              <dt className="font-semibold">商品代金以外の必要料金</dt>
              <dd className="sm:col-span-2">
                送料（チェックアウト画面に表示）／振込手数料（銀行振込を選択時）／国際配送時の関税・輸入税・通関手数料（受取人負担）
              </dd>

              <dt className="font-semibold">支払方法</dt>
              <dd className="sm:col-span-2">クレジットカード（Stripe決済）ほか、当店が別途定める方法</dd>

              <dt className="font-semibold">支払時期</dt>
              <dd className="sm:col-span-2">ご注文時にお支払いが確定します。</dd>

              <dt className="font-semibold">引渡時期</dt>
              <dd className="sm:col-span-2">{shipText}</dd>

              <dt className="font-semibold">返品・交換</dt>
              <dd className="sm:col-span-2">
                条件は <a className="underline" href="/refund">返品・返金ポリシー</a> をご確認ください。通信販売にはクーリング・オフは適用されません。
              </dd>

              <dt className="font-semibold">不良・誤配送時の対応</dt>
              <dd className="sm:col-span-2">{defectDaysText}</dd>

              <dt className="font-semibold">販売数量の制限</dt>
              <dd className="sm:col-span-2">転売目的等が疑われる場合、数量の制限またはご注文をお断りすることがあります。</dd>

              <dt className="font-semibold">事業者の名称・所在地の開示</dt>
              <dd className="sm:col-span-2">
                上記に記載。Web上での公開に支障がある場合、請求があれば遅滞なく電子メールで開示します。
              </dd>
            </dl>

            <p className="text-xs text-gray-500">
              本ストアは Pageit プラットフォーム上で <span className="font-semibold">{s.siteName || "本ストア"}</span> が運営しています。
              売買契約はお客様と <span className="font-semibold">{s.siteName || "本ストア"}</span> の間で成立します（決済代行：Stripe）。
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
