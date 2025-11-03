// src/app/owner-ec-guide/page.tsx
"use client";

import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Play,
} from "lucide-react";
import { useRouter } from "next/navigation";

/* ========= Types ========= */
type OwnerSettings = {
  siteName?: string;
  ownerName?: string;
  ownerAddress?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  businessHours?: string;
};

type RefundLite = { enabled?: boolean; windowDays?: number | null };

type ShippingPolicy = {
  enabled?: boolean;
  leadTimeMinDays?: number | null;
  leadTimeMaxDays?: number | null;
  // 互換フィールド（旧スキーマ）
  shipLeadMinDays?: number | null;
  shipLeadMaxDays?: number | null;
};

type SellerFlags = {
  ecStop?: boolean; // true=停止中
  ecGuideAcceptedAt?: any;
};

/* ========= Normalizers ========= */
function normalizeRefund(raw: any): RefundLite {
  const enabled =
    typeof raw?.enabled === "boolean"
      ? raw.enabled
      : String(raw?.enabled ?? "").toLowerCase() === "true";

  let wd: number | null = null;
  if (typeof raw?.windowDays === "number") wd = raw.windowDays;
  else if (typeof raw?.windowDays === "string") {
    const n = parseInt(raw.windowDays, 10);
    wd = Number.isFinite(n) && n > 0 ? n : null;
  }

  return { enabled, windowDays: wd };
}

function normalizeShip(raw: any): ShippingPolicy {
  if (!raw || typeof raw !== "object") return {};
  // 統一フィールド優先、なければ互換フィールドを採用
  const min =
    typeof raw.leadTimeMinDays === "number"
      ? raw.leadTimeMinDays
      : typeof raw.shipLeadMinDays === "number"
      ? raw.shipLeadMinDays
      : null;
  const max =
    typeof raw.leadTimeMaxDays === "number"
      ? raw.leadTimeMaxDays
      : typeof raw.shipLeadMaxDays === "number"
      ? raw.shipLeadMaxDays
      : null;
  const enabled =
    typeof raw.enabled === "boolean"
      ? raw.enabled
      : String(raw.enabled ?? "").toLowerCase() === "true";
  return { enabled, leadTimeMinDays: min, leadTimeMaxDays: max };
}

/* ========= Page ========= */
export default function OwnerECGuidePage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [s, setS] = useState<OwnerSettings>({});
  const [refund, setRefund] = useState<RefundLite>({});
  const [ship, setShip] = useState<ShippingPolicy>({});
  const [seller, setSeller] = useState<SellerFlags>({});

  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  // canonical は公開URLから
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";
  const canonical = APP_URL ? `${APP_URL}/owner-ec-guide` : "/owner-ec-guide";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setIsAdmin(!!u));
    return () => unsub();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 事業者情報（siteSettings/{SITE_KEY}）
        try {
          const settingsSnap = await getDoc(doc(db, "siteSettings", SITE_KEY));
          if (!alive) return;
          setS((settingsSnap.data() as any) ?? {});
        } catch {}

        // 返金ポリシー：API -> Firestore（現行）-> Firestore（互換）
        try {
          const res = await fetch(
            `/api/policies/refund?siteKey=${encodeURIComponent(SITE_KEY)}`,
            { cache: "no-store" }
          );
          if (res.ok) {
            const data = await res.json();
            if (!alive) return;
            setRefund(normalizeRefund(data?.policy));
          } else {
            // Firestore 現行パス
            const snap1 = await getDoc(
              doc(db, "sites", SITE_KEY, "policies", "refund")
            );
            if (!alive) return;
            if (snap1.exists()) setRefund(normalizeRefund(snap1.data()));
            else {
              // Firestore 旧/互換パス（必要なら）
              const snap2 = await getDoc(doc(db, "sitePolicies", SITE_KEY));
              if (!alive) return;
              if (snap2.exists()) setRefund(normalizeRefund(snap2.data()));
              else setRefund({});
            }
          }
        } catch {
          // Firestore 現行パス
          const snap1 = await getDoc(
            doc(db, "sites", SITE_KEY, "policies", "refund")
          );
          if (!alive) return;
          if (snap1.exists()) setRefund(normalizeRefund(snap1.data()));
          else {
            // Firestore 旧/互換パス
            const snap2 = await getDoc(doc(db, "sitePolicies", SITE_KEY));
            if (!alive) return;
            if (snap2.exists()) setRefund(normalizeRefund(snap2.data()));
            else setRefund({});
          }
        }

        // 出荷目安（siteShippingPolicy/{SITE_KEY}）
        try {
          const shipSnap = await getDoc(
            doc(db, "siteShippingPolicy", SITE_KEY)
          );
          if (!alive) return;
          if (shipSnap.exists()) setShip(normalizeShip(shipSnap.data()));
        } catch {}

        // EC状態（siteSellers/{SITE_KEY}）
        try {
          const sellerSnap = await getDoc(doc(db, "siteSellers", SITE_KEY));
          if (!alive) return;
          if (sellerSnap.exists()) setSeller(sellerSnap.data() as any);
        } catch {}
      } catch (e) {
        console.warn("[owner-ec-guide] load error:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 表示用
  const today = new Date();
  const ymd = `${today.getFullYear()}年${
    today.getMonth() + 1
  }月${today.getDate()}日`;

  const windowDays =
    typeof refund.windowDays === "number" && refund.windowDays > 0
      ? refund.windowDays
      : null;

  const leadMin =
    typeof ship.leadTimeMinDays === "number" ? ship.leadTimeMinDays : null;
  const leadMax =
    typeof ship.leadTimeMaxDays === "number" ? ship.leadTimeMaxDays : null;

  const shipText = useMemo(() => {
    const min = leadMin ?? 2;
    const max = leadMax ?? 5;
    if (leadMin != null && leadMax == null)
      return `通常、ご注文確定後${min}営業日以内に出荷します（予約・受注生産品を除く）。国際配送は通関等により遅延の可能性があります。`;
    if (leadMin == null && leadMax != null)
      return `通常、ご注文確定後〜${max}営業日以内に出荷します（予約・受注生産品を除く）。国際配送は通関等により遅延の可能性があります。`;
    return `通常、ご注文確定後${min}〜${max}営業日以内に出荷します（予約・受注生産品を除く）。国際配送は通関等により遅延の可能性があります。`;
  }, [leadMin, leadMax]);

  // チェックリスト判定
  const sellerInfoOK =
    !!s.siteName &&
    !!s.ownerName &&
    !!s.ownerAddress &&
    !!s.ownerEmail &&
    !!s.ownerPhone;

  const refundOK = !!refund.enabled && !!windowDays; // ← 正規化済みの値で判定

  const shipOK = !!ship.enabled || leadMin != null || leadMax != null;

  // 対応ページのリンク
  const links = [
    { href: "/tokushoho", label: "特定商取引法" },
    { href: "/privacy", label: "プライバシーポリシー" },
    { href: "/refund", label: "返品・返金ポリシー" },
    { href: "/terms", label: "利用規約（購入規約）" },
  ];

  const allReady = sellerInfoOK && refundOK; // 最低限: 事業者情報 & 返金ポリシー

  // （任意）同意→EC開始
  const startEC = async () => {
    if (!isAdmin || !allReady || !agree || saving) return;
    try {
      setSaving(true);
      await setDoc(
        doc(db, "siteSellers", SITE_KEY),
        {
          ecStop: false,
          ecGuideAcceptedAt: serverTimestamp(),
        },
        { merge: true }
      );
      alert("ECを開始しました。");
      router.push("/login");
    } catch (e) {
      console.error(e);
      alert("EC開始に失敗しました。しばらくしてから再度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-white">
        <section className="max-w-4xl mx-auto px-4 py-10">
          <h1 className="text-2xl font-bold">
            ECご利用前ガイド（オーナー向け）
          </h1>
          <p className="text-sm text-gray-500 mt-2">読み込み中…</p>
        </section>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>
          ECご利用前ガイド（オーナー向け）｜{s.siteName || "オンラインストア"}
        </title>
        <meta
          name="description"
          content={`EC開始前に必要な設定と運用ルールのガイドです。事業者情報・返金期限・出荷目安・必須ページの整備状況などを確認できます。`}
        />
        <link rel="canonical" href={canonical} />
        <meta
          property="og:title"
          content={`ECご利用前ガイド（オーナー向け）｜${
            s.siteName || "オンラインストア"
          }`}
        />
        <meta
          property="og:description"
          content="EC開始前に必要な設定と運用ルールのチェックリストと注意事項をまとめています。"
        />
        <meta property="og:type" content="article" />
      </Head>

      <main className="min-h-screen bg-white">
        <section className="max-w-4xl mx-auto px-4 py-10">
          <header className="mb-6">
            <h1 className="text-2xl font-bold">
              ECご利用前ガイド（オーナー向け）
            </h1>
            <p className="text-sm text-gray-500 mt-1">最終更新日：{ymd}</p>
          </header>

          {/* 概要 */}
          <div className="rounded-xl border p-4 bg-gray-50">
            <p className="text-[15px] leading-relaxed">
              本ページは、<b>{s.siteName || "本ストア"}</b>{" "}
              のEC（オンライン販売）を開始する前に
              必ず確認・同意いただくためのガイドです。下記のチェックリストが整っていない場合、
              返品・トラブル時の対応が不十分になり、顧客体験やコンプライアンス上の問題が発生します。
            </p>
          </div>

          {/* チェックリスト */}
          <section className="mt-8">
            <h2 className="text-xl font-semibold mb-3">準備チェックリスト</h2>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                {sellerInfoOK ? (
                  <CheckCircle2 className="text-green-600 mt-0.5" />
                ) : (
                  <AlertTriangle className="text-amber-600 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">事業者情報（siteSettings）</p>
                  <p className="text-sm text-gray-600">
                    販売業者名：{s.siteName || "—"}／責任者：
                    {s.ownerName || "—"}／住所：{s.ownerAddress || "—"}／
                    連絡先：{s.ownerEmail || "—"}・{s.ownerPhone || "—"}
                    {s.businessHours ? `（受付 ${s.businessHours}）` : ""}
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                {refundOK ? (
                  <CheckCircle2 className="text-green-600 mt-0.5" />
                ) : (
                  <AlertTriangle className="text-amber-600 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">
                    返品・返金ポリシー（sites/{SITE_KEY}/policies/refund）
                  </p>
                  <p className="text-sm text-gray-600">
                    {refund.enabled ? "有効" : "未有効"}／連絡期限：
                    {windowDays ? `${windowDays}日以内` : "未設定"}。
                    商品条件・送料負担・対象外条件など本文も整備してください。
                  </p>
                  <Link
                    className="inline-flex items-center gap-1 text-sm underline mt-1"
                    href="/refund"
                  >
                    返品・返金ポリシーページを開く <ExternalLink size={14} />
                  </Link>
                </div>
              </li>

              <li className="flex items-start gap-3">
                {shipOK ? (
                  <CheckCircle2 className="text-green-600 mt-0.5" />
                ) : (
                  <AlertTriangle className="text-amber-600 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">
                    出荷目安・配送方針（siteShippingPolicy）
                  </p>
                  <p className="text-sm text-gray-600">{shipText}</p>
                  <Link
                    className="inline-flex items-center gap-1 text-sm underline mt-1"
                    href="/shipping"
                  >
                    EC管理（配送設定）を開く <ExternalLink size={14} />
                  </Link>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <CheckCircle2 className="text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">必須ページ（整備と公開）</p>
                  <ul className="text-sm text-gray-600 list-disc pl-5">
                    {links.map((l) => (
                      <li key={l.href}>
                        <Link className="underline" href={l.href}>
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            </ul>
          </section>

          {/* ルール説明 */}
          <section className="mt-10">
            <h2 className="text-xl font-semibold mb-3">運用ルール（抜粋）</h2>
            <div className="space-y-4 text-[15px] leading-relaxed">
              <p>
                <ShieldCheck className="inline mr-2 text-gray-700" />
                <b>契約の成立：</b>{" "}
                ご注文完了画面の表示または確認メール送信時点で成立。以降の変更やキャンセルは原則不可（各ポリシーに従う）。
              </p>
              <p>
                <ShieldCheck className="inline mr-2 text-gray-700" />
                <b>価格・通貨：</b> 表示は税込。決済は Stripe
                で処理され、通貨換算表示は参考値。最終請求額はカード会社レート等に依存。
              </p>
              <p>
                <ShieldCheck className="inline mr-2 text-gray-700" />
                <b>配送と通関：</b> 国際配送は原則
                DDU（受取人関税負担）。住所不備・受取拒否等は往復送料や手数料が発生することあり。
              </p>
              <p>
                <ShieldCheck className="inline mr-2 text-gray-700" />
                <b>返品・交換：</b> 初期不良／誤配送は
                {windowDays
                  ? `到着後${windowDays}日以内`
                  : "到着後速やかに"}{" "}
                連絡。詳細は
                <Link className="underline ml-1" href="/refund">
                  返品・返金ポリシー
                </Link>
                を遵守。
              </p>
              <p>
                <ShieldCheck className="inline mr-2 text-gray-700" />
                <b>禁止事項：</b>{" "}
                法令違反・危険物・医薬品・ニコチン/アルコール・武器・違法コピー等、各国の規制対象品の販売は禁止。
              </p>
            </div>
          </section>

          {/* 同意＆開始（管理者のみ表示） */}
          {isAdmin && (
            <section className="mt-10 rounded-xl border p-4">
              <h3 className="text-lg font-semibold mb-2">同意とEC開始</h3>
              <p className="text-sm text-gray-600">
                上記の内容と各ページ（
                <Link className="underline" href="/terms">
                  利用規約
                </Link>
                ／
                <Link className="underline" href="/privacy">
                  プライバシー
                </Link>
                ／
                <Link className="underline" href="/tokushoho">
                  特商法
                </Link>
                ／
                <Link className="underline" href="/refund">
                  返金ポリシー
                </Link>
                ）を確認し、遵守します。
              </p>

              <label className="flex items-center gap-2 mt-3 select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span className="text-sm">ガイド内容に同意しました</span>
              </label>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={startEC}
                  disabled={!allReady || !agree || saving}
                  className={`inline-flex items-center gap-2 px-4 h-11 rounded-md text-white ${
                    !allReady || !agree || saving
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                  title={
                    !allReady
                      ? "チェックリストを先に完了してください"
                      : "ECを開始"
                  }
                >
                  <Play size={18} />
                  ECを開始する
                </button>

                <p className="text-xs text-gray-500">
                  現在：{seller.ecStop === false ? "稼働中" : "停止中"}
                  {seller.ecGuideAcceptedAt ? "（同意済）" : ""}
                </p>
              </div>
            </section>
          )}
        </section>
      </main>
    </>
  );
}
