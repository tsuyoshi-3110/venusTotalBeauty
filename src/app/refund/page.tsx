// app/refund/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { LANGS } from "@/lib/langs";
import type { LangKey } from "@/lib/langs";
import { useUILang } from "@/lib/atoms/uiLangAtom";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

/* =========================
   型
========================= */
type PolicyByLang = Record<string, { title?: string; body: string }>;
type RefundPolicy = {
  enabled: boolean;
  windowDays: number;
  eligibility: "any" | "unopened" | "defective-only" | "no-returns" | "custom";
  shippingCharge: "buyer" | "seller" | "case-by-case";
  refundMethod: "original" | "store-credit" | "exchange";
  restockingFeePct?: number;
  notes?: string;
  contentByLang: PolicyByLang;
  updatedAt?: string;
};

/* =========================
   デフォルト値
========================= */
const defaultPolicy = (): RefundPolicy => ({
  enabled: true,
  windowDays: 14,
  eligibility: "any",
  shippingCharge: "buyer",
  refundMethod: "original",
  restockingFeePct: 0,
  notes: "",
  contentByLang: {
    ja: {
      title: "返品・返金ポリシー",
      body:
        "商品到着後14日以内にご連絡ください。未使用・未開封の商品に限り返品・交換を承ります（不良品は除く）。返送送料はお客様負担となります。詳しくは本ページの条件をご確認ください。",
    },
    en: {
      title: "Refund & Returns Policy",
      body:
        "Please contact us within 14 days of delivery. Returns or exchanges are accepted for unused and unopened items (except defective items). Return shipping cost is borne by the customer.",
    },
  },
});

/* =========================
   言語テンプレ
========================= */
function templateFor(
  lang: LangKey,
  p: RefundPolicy
): { title: string; body: string } {
  const en = {
    title: "Refund & Returns Policy",
    body:
      `Contact us within ${p.windowDays} days of delivery. ` +
      (p.eligibility === "no-returns"
        ? "We do not accept returns for customer remorse. Defective or damaged items will be handled individually. "
        : p.eligibility === "defective-only"
        ? "Only defective, damaged, or wrong items are eligible for return or exchange. "
        : p.eligibility === "unopened"
        ? "Returns are accepted for unopened items only (defective items excluded). "
        : "Returns or exchanges are accepted for unused and unopened items (defective items excluded). ") +
      `Return shipping is ` +
      (p.shippingCharge === "seller"
        ? "covered by us. "
        : p.shippingCharge === "case-by-case"
        ? "determined case by case. "
        : "borne by the customer. ") +
      (p.restockingFeePct && p.restockingFeePct > 0
        ? `A restocking fee of ${p.restockingFeePct}% may apply. `
        : "") +
      (p.refundMethod === "store-credit"
        ? "Refunds are issued as store credit."
        : p.refundMethod === "exchange"
        ? "Exchanges are provided in principle."
        : "Refunds are processed to the original payment method.") +
      (p.notes ? `\n\nNotes:\n${p.notes}` : ""),
  };

  if (lang === "ja") {
    return {
      title: "返品・返金ポリシー",
      body:
        `商品到着後${p.windowDays}日以内にご連絡ください。` +
        (p.eligibility === "no-returns"
          ? "お客様都合による返品は承っておりません。不良・破損の場合は個別にご案内いたします。"
          : p.eligibility === "defective-only"
          ? "不良・破損・誤配送のみ返品・交換を承ります。"
          : p.eligibility === "unopened"
          ? "未開封品のみ返品可（不良品はこの限りではありません）。"
          : "未使用・未開封の商品に限り返品・交換を承ります（不良品はこの限りではありません）。") +
        ` 返送送料は${
          p.shippingCharge === "seller"
            ? "当店負担"
            : p.shippingCharge === "case-by-case"
            ? "ケースにより異なります"
            : "お客様負担"
        }です。` +
        (p.restockingFeePct && p.restockingFeePct > 0
          ? ` 返品手数料として商品代金の${p.restockingFeePct}%を差し引いて返金します。`
          : "") +
        (p.refundMethod === "store-credit"
          ? " 返金はストアクレジットで行います。"
          : p.refundMethod === "exchange"
          ? " 原則として交換対応となります。"
          : " 返金は原則お支払い方法に準じて行います。") +
        (p.notes ? `\n\n【注意事項】\n${p.notes}` : ""),
    };
  }
  return en;
}

/* =========================
   保存時：全言語を必ず埋める
========================= */
function ensureAllLangs(src: RefundPolicy): RefundPolicy {
  const next: RefundPolicy = {
    ...src,
    contentByLang: { ...src.contentByLang },
  };
  for (const { key } of LANGS) {
    const k = key as LangKey;
    if (!next.contentByLang[k] || !next.contentByLang[k].body) {
      next.contentByLang[k] = templateFor(k, next);
    }
  }
  return next;
}

/* =========================
   ページ本体
========================= */
export default function RefundPage() {
  const router = useRouter();
  const { uiLang } = useUILang();

  // 認証
  const [authReady, setAuthReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  // データ
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<RefundPolicy | null>(null);
  const [saving, setSaving] = useState(false);

  // 日本語本文：自動生成トグル
  const [autoGenJa, setAutoGenJa] = useState<boolean>(true);

  // 認証監視
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setIsAuthed(!!u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // 取得
  useEffect(() => {
    if (!authReady) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/policies/refund?siteKey=${encodeURIComponent(SITE_KEY)}`,
          { cache: "no-store" }
        );
        if (!alive) return;
        if (res.ok) {
          const data = await res.json();
          const incoming: RefundPolicy | null = data?.policy ?? null;
          if (isAuthed) {
            setPolicy(
              ensureAllLangs(
                incoming ? { ...defaultPolicy(), ...incoming } : defaultPolicy()
              )
            );
          } else {
            setPolicy(incoming); // 公開は保存済み言語のみ
          }
        } else {
          setPolicy(isAuthed ? ensureAllLangs(defaultPolicy()) : null);
        }
      } catch {
        setPolicy(isAuthed ? ensureAllLangs(defaultPolicy()) : null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authReady, isAuthed]);

  // 公開ビューの表示言語（ヘッダーのピッカー優先）
  const effectiveLang: LangKey = useMemo(() => {
    const prefer = uiLang as LangKey;
    const avail = policy
      ? (Object.keys(policy.contentByLang) as LangKey[])
      : [];
    if (!avail.length) return (prefer || "ja") as LangKey;
    if (avail.includes(prefer)) return prefer;
    if (avail.includes("ja" as LangKey)) return "ja";
    return avail[0] as LangKey;
  }, [policy, uiLang]);

  // 編集は日本語のみ
  const EDIT_LANG: LangKey = "ja";
  const updateField = <K extends keyof RefundPolicy>(
    key: K,
    value: RefundPolicy[K]
  ) => setPolicy((p) => (p ? { ...p, [key]: value } : p));

  const updateLangContentJa = (field: "title" | "body", value: string) =>
    setPolicy((p) =>
      p
        ? {
            ...p,
            contentByLang: {
              ...p.contentByLang,
              [EDIT_LANG]: { ...p.contentByLang[EDIT_LANG], [field]: value },
            },
          }
        : p
    );

  // 左の条件から日本語テンプレを都度生成（依存は policy のみ）
  const generatedJa = useMemo(() => {
    if (!policy) return { title: "返品・返金ポリシー", body: "" };
    return templateFor("ja" as LangKey, policy);
  }, [policy]);

  // 右側表示用：自動生成ONなら generated、OFFなら手入力（curJa）
  const curJa = policy?.contentByLang?.[EDIT_LANG] ?? { title: "", body: "" };
  const jaTitle = autoGenJa ? generatedJa.title : (curJa.title ?? "");
  const jaBody = autoGenJa ? generatedJa.body : (curJa.body ?? "");

  const insertTemplateJa = () => {
    if (!policy) return;
    // 自動生成のまま押されたら手入力モードに切替して、直近テンプレを流し込む
    setAutoGenJa(false);
    updateLangContentJa("title", generatedJa.title);
    updateLangContentJa("body", generatedJa.body);
  };

  const handleSave = async () => {
    if (!policy) return;
    const user = auth.currentUser;
    if (!user) {
      alert("ログインが必要です。");
      return;
    }
    setSaving(true);
    try {
      const token = await user.getIdToken();

      // 自動生成ONのときは JA を生成結果で上書きして保存
      const base: RefundPolicy = autoGenJa
        ? {
            ...policy,
            contentByLang: {
              ...policy.contentByLang,
              ja: { title: generatedJa.title, body: generatedJa.body },
            },
          }
        : policy;

      const payload: RefundPolicy = ensureAllLangs({
        ...base,
        updatedAt: new Date().toISOString(),
      });

      const res = await fetch("/api/policies/refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ siteKey: SITE_KEY, policy: payload }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `HTTP ${res.status}`);
      }
      alert("保存しました。");
      router.refresh();
    } catch (e: any) {
      alert(`保存に失敗しました：${e?.message || "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  // ローディング
  if (!authReady || loading) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-2xl font-bold">返金ポリシー</h1>
        <p className="mt-4 text-gray-600">読み込み中…</p>
      </main>
    );
  }

  /* =========================
     未ログイン：公開ビューのみ
  ========================= */
  if (!isAuthed) {
    const dir: "rtl" | "ltr" = effectiveLang === "ar" ? "rtl" : "ltr";
    const title =
      (policy && policy.contentByLang?.[effectiveLang]?.title) ||
      (policy
        ? policy.contentByLang?.[Object.keys(policy.contentByLang)[0]]?.title
        : "") ||
      "Refund Policy";
    const body =
      (policy && policy.contentByLang?.[effectiveLang]?.body) ||
      (policy
        ? policy.contentByLang?.[Object.keys(policy.contentByLang)[0]]?.body
        : "") ||
      "";

    const updatedText = (() => {
      if (!policy?.updatedAt) return null;
      const d = new Date(policy.updatedAt);
      return isNaN(d.getTime())
        ? null
        : d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
    })();

    return (
      <main
        className="mx-auto max-w-3xl px-5 py-5 ml-5 mr-5 bg-white/50 mt-10 rounded-2xl"
        dir={dir}
      >
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold break-words text-white text-outline">
            {title || "Refund & Returns Policy"}
          </h1>
        </div>

        {updatedText && (
          <p className="mt-1 text-xs text-gray-500">
            Last updated: {updatedText}
          </p>
        )}

        {!policy ? (
          <div className="mt-6 rounded border bg-white p-4">
            <p>
              この店舗の返金ポリシーは現在準備中です。ご不明点は
              <Link href="/contact" className="text-blue-600 underline">
                お問い合わせ
              </Link>
              よりご連絡ください。
            </p>
          </div>
        ) : policy.enabled === false && !body ? (
          <div className="mt-6 rounded border bg-white p-4">
            <p>
              現在、返金ポリシーは公開されていません。購入前に販売者へお問い合わせください。
            </p>
          </div>
        ) : (
          <article className="prose prose-sm sm:prose-base mt-6 max-w-none whitespace-pre-wrap">
            {body || "（本文未設定）"}
          </article>
        )}
      </main>
    );
  }

  /* =========================
     ログイン済み：上=公開ビュー / 下=編集フォーム
  ========================= */
  const dir: "rtl" | "ltr" = effectiveLang === "ar" ? "rtl" : "ltr";
  const pubTitle =
    (policy && policy.contentByLang?.[effectiveLang]?.title) ||
    policy?.contentByLang?.[Object.keys(policy.contentByLang)[0]]?.title ||
    "Refund Policy";
  const pubBody =
    (policy && policy.contentByLang?.[effectiveLang]?.body) ||
    policy?.contentByLang?.[Object.keys(policy.contentByLang)[0]]?.body ||
    "";
  const updatedText = (() => {
    if (!policy?.updatedAt) return null;
    const d = new Date(policy.updatedAt);
    return isNaN(d.getTime())
      ? null
      : d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
  })();

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      {/* 上：公開ビュー（現時点で保存済みの内容） */}
      <section className="bg-white/60 rounded-2xl p-5 border" dir={dir}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold break-words">
            {pubTitle || "Refund & Returns Policy"}
          </h1>
          <span className="text-xs text-gray-500">（公開ビュー / 保存済み）</span>
        </div>
        {updatedText && (
          <p className="mt-1 text-xs text-gray-500">
            Last updated: {updatedText}
          </p>
        )}
        <article className="prose prose-sm sm:prose-base mt-4 max-w-none whitespace-pre-wrap">
          {policy?.enabled === false && !pubBody
            ? "現在、返金ポリシーは公開されていません。"
            : pubBody || "（本文未設定）"}
        </article>
      </section>

      {/* 仕切り */}
      <div className="my-6 h-px bg-gray-200" />

      {/* 下：編集フォーム（左：条件 / 右：日本語本文 自動⇄手入力） */}
      {!policy ? (
        <p className="text-gray-600">初期化中…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左：共通条件 */}
          <section className="bg-white/80 backdrop-blur rounded-xl border p-5 space-y-4">
            <div className="text-sm text-gray-500 -mt-1 mb-1">
              編集言語：<strong>日本語（ja）</strong>
              <span className="ml-2 text-gray-400">※ 保存時に他言語へ自動反映</span>
            </div>

            <label className="flex items-center justify-between">
              <span className="font-medium">返品・返金に対応する</span>
              <input
                type="checkbox"
                checked={policy.enabled}
                onChange={(e) => updateField("enabled", e.target.checked)}
                className="h-5 w-5 accent-purple-600"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col text-sm">
                申請期限（日）
                <input
                  type="number"
                  min={0}
                  value={policy.windowDays}
                  onChange={(e) =>
                    updateField(
                      "windowDays",
                      Math.max(0, Number(e.target.value || 0))
                    )
                  }
                  className="mt-1 rounded border px-3 py-2"
                />
              </label>

              <label className="flex flex-col text-sm">
                返品手数料（%）
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={policy.restockingFeePct ?? 0}
                  onChange={(e) =>
                    updateField(
                      "restockingFeePct",
                      Math.min(100, Math.max(0, Number(e.target.value || 0)))
                    )
                  }
                  className="mt-1 rounded border px-3 py-2"
                />
              </label>
            </div>

            <label className="flex flex-col text-sm">
              対象条件
              <select
                value={policy.eligibility}
                onChange={(e) =>
                  updateField(
                    "eligibility",
                    e.target.value as RefundPolicy["eligibility"]
                  )
                }
                className="mt-1 rounded border px-3 py-2"
              >
                <option value="any">未使用・未開封なら可（不良は別扱い）</option>
                <option value="defective-only">不良・破損・誤配送のみ可</option>
                <option value="no-returns">お客様都合は不可（不良時のみ個別対応）</option>
                <option value="unopened">未開封のみ可</option>
                <option value="custom">カスタム（文面で明記）</option>
              </select>
            </label>

            <label className="flex flex-col text-sm">
              返送送料負担
              <select
                value={policy.shippingCharge}
                onChange={(e) =>
                  updateField(
                    "shippingCharge",
                    e.target.value as RefundPolicy["shippingCharge"]
                  )
                }
                className="mt-1 rounded border px-3 py-2"
              >
                <option value="buyer">お客様負担</option>
                <option value="seller">当店負担</option>
                <option value="case-by-case">ケースバイケース</option>
              </select>
            </label>

            <label className="flex flex-col text-sm">
              返金手段
              <select
                value={policy.refundMethod}
                onChange={(e) =>
                  updateField(
                    "refundMethod",
                    e.target.value as RefundPolicy["refundMethod"]
                  )
                }
                className="mt-1 rounded border px-3 py-2"
              >
                <option value="original">元のお支払い方法へ返金</option>
                <option value="store-credit">ストアクレジット</option>
                <option value="exchange">交換対応</option>
              </select>
            </label>

            <label className="flex flex-col text-sm">
              備考（国際配送・関税・EU撤回権 注記など）
              <textarea
                rows={3}
                value={policy.notes || ""}
                onChange={(e) => updateField("notes", e.target.value)}
                className="mt-1 rounded border px-3 py-2"
                placeholder="例）国際返品の関税・手数料は返金対象外です。EU/UKのお客様は、消費者保護法に基づく撤回権が適用される場合があります。"
              />
            </label>
          </section>

          {/* 右：日本語のみ編集＋プレビュー（自動生成トグルあり） */}
          <section className="bg-white/80 backdrop-blur rounded-xl border p-5">
            <div className="text-sm text-gray-500">
              言語別コンテンツ（日本語のみ編集）
            </div>

            {/* 自動生成トグル */}
            <label className="mt-3 mb-2 inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoGenJa}
                onChange={(e) => setAutoGenJa(e.target.checked)}
              />
              <span className="text-sm">自動生成（左の条件から本文を作成）</span>
            </label>

            <div className="mt-2 space-y-2">
              <label className="flex flex-col text-sm">
                タイトル（日本語）
                <input
                  type="text"
                  value={jaTitle}
                  disabled={autoGenJa}
                  onChange={(e) => updateLangContentJa("title", e.target.value)}
                  className="mt-1 rounded border px-3 py-2 disabled:opacity-60"
                  placeholder="例）返品・返金ポリシー"
                />
                {autoGenJa && (
                  <span className="text-xs text-gray-500 mt-1">
                    自動生成中は編集できません（トグルをOFFで編集可）
                  </span>
                )}
              </label>

              <label className="flex flex-col text.sm">
                本文（日本語）
                <textarea
                  rows={8}
                  value={jaBody}
                  disabled={autoGenJa}
                  onChange={(e) => updateLangContentJa("body", e.target.value)}
                  className="mt-1 rounded border px-3 py-2 disabled:opacity-60"
                  placeholder="ポリシー本文を入力してください"
                />
                {autoGenJa && (
                  <span className="text-xs text-gray-500 mt-1">
                    自動生成中は編集できません（トグルをOFFで編集可）
                  </span>
                )}
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={insertTemplateJa}
                  className="px-3 py-2 rounded bg-gray-100 border hover:bg-gray-200"
                >
                  日本語テンプレ挿入
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {saving ? "保存中…" : "保存する"}
                </button>
              </div>

              {/* プレビュー（日本語・編集中の内容） */}
              <div className="mt-4">
                <div className="text-sm text-gray-500 mb-2">
                  プレビュー（日本語 / 編集中）
                </div>
                <h2 className="text-lg font-semibold">{jaTitle || "（タイトル）"}</h2>
                <article className="prose prose-sm sm:prose-base mt-2 whitespace-pre-wrap">
                  {jaBody || "（本文未設定）"}
                </article>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
