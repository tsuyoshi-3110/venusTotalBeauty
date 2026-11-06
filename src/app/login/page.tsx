"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import {
  LucideLogIn,
  LogOut,
  AlertCircle,
  Globe,
  Box,
  ShieldCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ForgotPassword from "@/components/ForgotPassword";
import ChangePassword from "@/components/ChangePassword";
import ForgotEmail from "@/components/ForgotEmail";
import PasswordInput from "@/components/PasswordInput";
import FontSwitcher from "@/components/FontSwitcher";
import ThemeSelector from "@/components/ThemeSelector";
import { ThemeKey } from "@/lib/themes";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import ImageLogoControls from "@/components/ImageLogoControls";
import { Clock } from "lucide-react";
import { Search } from "lucide-react";

// UI言語一覧（既存定義を利用）
import { LANGS } from "@/lib/langs";
import type { UILang } from "@/lib/atoms/uiLangAtom";

// Google Maps Places
import { Loader } from "@googlemaps/js-api-loader";

// Firestore ref
const META_REF = doc(db, "siteSettingsEditable", SITE_KEY);
const SELLER_REF = doc(db, "siteSellers", SITE_KEY);

/* =========================
   Stripe Connect カード（住所設定ボタン込み）
========================= */
function StripeConnectCard() {
  const [loading, setLoading] = useState(false);
  const [connectStatus, setConnectStatus] = useState<
    "unknown" | "notStarted" | "inProgress" | "completed" | "error"
  >("unknown");
  const [connectId, setConnectId] = useState<string | null>(null);

  const [holdDays, setHoldDays] = useState<number>(30);
  const [fees, setFees] = useState({ stripe: 3.6, platform: 1.0, env: 1.0 });
  const feeTotal = (fees.stripe + fees.platform + fees.env).toFixed(1);

  const sellerId = SITE_KEY; // docID = siteKey

  const GLOBAL_REF = doc(db, "adminSettings", "global");

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(GLOBAL_REF);
        const d = (snap.data() as any) || {};
        const v = Number(d?.payoutHoldDays);
        if (Number.isFinite(v) && v > 0) setHoldDays(v);

        // 任意：global に fees があれば上書き
        if (d?.fees) {
          setFees({
            stripe: Number(d.fees.stripe) || 3.6,
            platform: Number(d.fees.platform) || 2.4,
            env: Number(d.fees.env) || 1.0,
          });
        }
      } catch (e) {
        console.error("Failed to load payout policy:", e);
      }
    })();
  }, [GLOBAL_REF]);

  const fetchStatus = async () => {
    try {
      setConnectStatus("unknown");
      const res = await fetch(
        `/api/sellers/connect-status?siteKey=${encodeURIComponent(sellerId)}`
      );
      const data: any = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");
      setConnectStatus((data?.status as typeof connectStatus) ?? "notStarted");
      setConnectId(data?.connectAccountId ?? null);
    } catch {
      setConnectStatus("error");
      setConnectId(null);
    }
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startOnboarding = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/stripe/create-onboarding-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId, siteKey: SITE_KEY }),
      });
      const data: any = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.error || "failed");
      window.location.href = data.url;
    } catch {
      alert("Stripe連携の開始に失敗しました");
      fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-xl bg-white/50">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Stripe 連携（出店者アカウント）
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="text-sm space-y-1">
          <div>
            <span className="font-semibold">状態: </span>
            {connectStatus === "unknown" && "確認中…"}
            {connectStatus === "notStarted" && "未連携"}
            {connectStatus === "inProgress" && "入力途中（未完了）"}
            {connectStatus === "completed" && "連携完了"}
            {connectStatus === "error" && "取得エラー"}
          </div>
          <div className="text-xs text-gray-600">
            ConnectアカウントID:{" "}
            {connectId ? <code className="break-all">{connectId}</code> : "—"}
          </div>
        </div>

        {/* アクション行 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Button
            onClick={startOnboarding}
            disabled={loading}
            className="w-full sm:flex-1 bg-black text-white"
          >
            {loading
              ? "開始中..."
              : connectStatus === "notStarted"
              ? "Stripe連携を開始"
              : "Stripe連携を続行"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={fetchStatus}
            disabled={loading}
            className="w-full sm:w-auto sm:min-w-[96px]"
            title="状態を再取得"
          >
            再取得
          </Button>
        </div>

        <p className="text-xs text-gray-600">
          ボタンを押すとStripeのオンボーディング画面へ遷移します。完了後は
          <code>/onboarding/return</code> に戻り、完了フラグが更新されます。
        </p>

        <div className="rounded-xl border bg-white/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={16} />
            <span className="text-sm font-semibold">支払い条件（Pageit）</span>
          </div>
          <ul className="list-disc pl-5 text-sm leading-6">
            <li>保留期間：{holdDays}日（苦情受付時は延長/凍結）</li>
            <li>入金タイミング：毎週金曜（自動）／銀行着金：当日〜翌営業日</li>
            <li>
              手数料：合計 {feeTotal}%（Stripe {fees.stripe}% + 運営{" "}
              {fees.platform}% + 環境寄付 {fees.env}%）
            </li>
            <li>
              返金・チャージバック：振替前は送金停止、振替後は次回送金で相殺（不足時は請求）
            </li>
          </ul>
          <p className="text-xs text-gray-500 mt-2">
            ※
            Stripeの審査/口座エラー/追加書類がある場合は入金が一時停止されます。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* =========================
   Ship&co への導線カード（アカウント作成リンク）
========================= */
function ShipAndCoLinkCard() {
  return (
    <Card className="shadow-xl bg-white/70 backdrop-blur-sm border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Box size={18} />
          出荷管理のご案内（Ship&co）
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 text-sm leading-relaxed text-gray-700">
        <p>
          商品の発送や集荷依頼、送り状の作成を行う際は、 外部サービス{" "}
          <span className="font-medium">Ship&co（シップアンドコー）</span> を
          ご利用いただくと便利です。
        </p>

        <p>
          主要な運送会社（ヤマト・佐川・日本郵便など）に対応しており、
          宛先情報を入力するだけでラベル発行や追跡管理までワンストップで行えます。
        </p>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <a
            href="https://app.shipandco.com/welcome"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto"
          >
            <Button className="w-full">🚀 Ship&coを開く</Button>
          </a>
          <a
            href="https://support.shipandco.com/hc/ja/articles/360001253013"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto"
          ></a>
        </div>

        <p className="text-xs text-gray-500 pt-2">
          ※Ship&coは外部サイトです。無料登録でご利用いただけます。
          <br />
          Pageitの「注文一覧」からCSVを出力し、Ship&coに取り込むことで発送作業をスムーズに行えます。
        </p>
      </CardContent>
    </Card>
  );
}

/* =========================
   日本語表記の言語ラベル
========================= */
const JP_LANG_LABELS: Record<UILang, string> = {
  ja: "日本語",
  en: "英語",
  zh: "中国語（簡体字）",
  "zh-TW": "中国語（繁体字）",
  ko: "韓国語",
  fr: "フランス語",
  es: "スペイン語",
  de: "ドイツ語",
  pt: "ポルトガル語",
  it: "イタリア語",
  ru: "ロシア語",
  th: "タイ語",
  vi: "ベトナム語",
  id: "インドネシア語",
  hi: "ヒンディー語",
  ar: "アラビア語",
};

/* =========================
   サブコンポーネント
========================= */

function SectionTitle({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <p className="text-sm font-medium">{children}</p>
    </div>
  );
}

/** 多言語設定カード（翻訳オン/オフ ＋ 対応言語の選択） */
function I18nSettingsCard({
  enabled,
  langs,
  onToggleEnabled,
  onToggleLang,
  onSelectAll,
  onClearAll,
}: {
  enabled: boolean;
  langs: UILang[];
  onToggleEnabled: (v: boolean) => void;
  onToggleLang: (lang: UILang, checked: boolean) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  // 日本語を先頭に固定
  type LangItem = (typeof LANGS)[number];

  const sorted = Array.from(LANGS).sort((a: LangItem, b: LangItem) =>
    a.key === "ja"
      ? -1
      : b.key === "ja"
      ? 1
      : String(a.key).localeCompare(String(b.key))
  );

  const getJpLabel = (key: string) => {
    const k = key as UILang;
    return JP_LANG_LABELS[k] ?? key; // 不明なキーはそのまま表示
  };

  return (
    <Card className="shadow-xl bg-white/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Globe size={18} />
          多言語設定（翻訳・UI言語）
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 翻訳/多言語UI トグル */}
        <div className="flex items-center justify-between">
          <SectionTitle>多言語表示（翻訳）を有効にする</SectionTitle>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">{enabled ? "ON" : "OFF"}</span>
          </label>
        </div>

        {/* 言語の選択（ラベルは日本語表記） */}
        <div>
          <SectionTitle>表示・編集対象の言語</SectionTitle>

          <div className="flex flex-wrap gap-3">
            {sorted.map((l: any) => {
              const key = l.key as UILang;
              const checked = langs.includes(key);
              const disabled = key === "ja"; // 日本語は常にON（固定）
              return (
                <label
                  key={key}
                  className={`inline-flex items-center gap-2 rounded border px-2 py-1 bg-white/80 ${
                    disabled ? "opacity-70 cursor-not-allowed" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked || disabled}
                    disabled={disabled}
                    onChange={(e) => onToggleLang(key, e.target.checked)}
                  />
                  <span className="text-sm">
                    {getJpLabel(key)}{" "}
                    <span className="text-xs text-gray-500">({key})</span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex gap-2 mt-3">
            <Button
              type="button"
              variant="outline"
              onClick={onSelectAll}
              className="h-8"
            >
              全選択
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClearAll}
              className="h-8"
            >
              日本語以外を全解除
            </Button>
          </div>

          {!enabled && (
            <p className="mt-2 text-xs text-gray-600">
              ※ OFF
              の間は多言語UIや自動翻訳を抑止する想定です（他コンポーネント側の実装に依存します）。
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// I18nSettingsCard の定義ブロックの直後あたりに丸ごと追加

/* =========================
   営業時間設定カード（追加）
========================= */
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type TimeRange = { start: string; end: string };
type DayHours = { closed: boolean; ranges: TimeRange[] };
type BusinessHours = {
  enabled: boolean;
  tz: string; // 例: "Asia/Tokyo"
  days: Record<DayKey, DayHours>;
  notes?: string;
};

const DAY_LABEL_JA: Record<DayKey, string> = {
  mon: "月",
  tue: "火",
  wed: "水",
  thu: "木",
  fri: "金",
  sat: "土",
  sun: "日",
};

const DEFAULT_BH: BusinessHours = {
  enabled: false,
  tz: "Asia/Tokyo",
  days: {
    mon: { closed: false, ranges: [{ start: "09:00", end: "18:00" }] },
    tue: { closed: false, ranges: [{ start: "09:00", end: "18:00" }] },
    wed: { closed: false, ranges: [{ start: "09:00", end: "18:00" }] },
    thu: { closed: false, ranges: [{ start: "09:00", end: "18:00" }] },
    fri: { closed: false, ranges: [{ start: "09:00", end: "18:00" }] },
    sat: { closed: true, ranges: [] },
    sun: { closed: true, ranges: [] },
  },
  notes: "",
};

function BusinessHoursCard() {
  const [bh, setBh] = useState<BusinessHours>(DEFAULT_BH);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);

  // 初期ロード
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(META_REF);
        const d = (snap.data() as any) ?? {};
        const next: BusinessHours = {
          ...DEFAULT_BH,
          ...(d.businessHours || {}),
          days: { ...DEFAULT_BH.days, ...(d.businessHours?.days || {}) },
        };
        (Object.keys(next.days) as DayKey[]).forEach((k) => {
          const v = next.days[k];
          if (!Array.isArray(v.ranges)) v.ranges = [];
          v.ranges = v.ranges
            .map((r) => ({
              start: String(r?.start ?? "09:00").slice(0, 5),
              end: String(r?.end ?? "18:00").slice(0, 5),
            }))
            .slice(0, 2);
        });
        setBh(next);
      } catch (e) {
        console.error("businessHours load error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 自動保存（600ms デバウンス）
  const scheduleSave = (next: BusinessHours) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        setSaving(true);
        await setDoc(META_REF, { businessHours: next }, { merge: true });
      } catch (e) {
        console.error("businessHours save error:", e);
        alert("営業時間の保存に失敗しました");
      } finally {
        setSaving(false);
      }
    }, 600) as unknown as number;
  };

  const updateBh = (patch: Partial<BusinessHours>) => {
    const next = { ...bh, ...patch };
    setBh(next);
    scheduleSave(next);
  };

  const toggleDayClosed = (day: DayKey, closed: boolean) => {
    const next = {
      ...bh,
      days: {
        ...bh.days,
        [day]: {
          ...bh.days[day],
          closed,
          ranges: closed
            ? []
            : bh.days[day].ranges.length
            ? bh.days[day].ranges
            : [{ start: "09:00", end: "18:00" }],
        },
      },
    };
    setBh(next);
    scheduleSave(next);
  };

  const setRange = (
    day: DayKey,
    idx: number,
    key: "start" | "end",
    val: string
  ) => {
    const ranges = [...(bh.days[day].ranges || [])];
    while (ranges.length <= idx) ranges.push({ start: "09:00", end: "18:00" });
    ranges[idx] = { ...ranges[idx], [key]: val.slice(0, 5) };
    const next = {
      ...bh,
      days: { ...bh.days, [day]: { ...bh.days[day], ranges } },
    };
    setBh(next);
    scheduleSave(next);
  };

  const addRange = (day: DayKey) => {
    const ranges = [...(bh.days[day].ranges || [])];
    if (ranges.length >= 2) return;
    ranges.push({ start: "13:00", end: "17:00" });
    const next = {
      ...bh,
      days: { ...bh.days, [day]: { ...bh.days[day], ranges } },
    };
    setBh(next);
    scheduleSave(next);
  };

  const removeSecondRange = (day: DayKey) => {
    const ranges = [...(bh.days[day].ranges || [])].slice(0, 1);
    const next = {
      ...bh,
      days: { ...bh.days, [day]: { ...bh.days[day], ranges } },
    };
    setBh(next);
    scheduleSave(next);
  };

  const fmtPreview = (d: DayHours) => {
    if (d.closed) return "休業";
    if (!d.ranges?.length) return "—";
    return d.ranges.map((r) => `${r.start}〜${r.end}`).join("／");
  };

  if (loading) {
    return (
      <Card className="shadow-xl bg-white/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Clock size={18} />
            営業時間
          </CardTitle>
        </CardHeader>
        <CardContent>読み込み中…</CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl bg-white/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Clock size={18} />
          営業時間
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">
            営業時間をサイト／AIで案内する
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={bh.enabled}
              onChange={(e) => updateBh({ enabled: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm">{bh.enabled ? "ON" : "OFF"}</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm w-28">タイムゾーン</label>
          <select
            value={bh.tz}
            onChange={(e) => updateBh({ tz: e.target.value })}
            className="border rounded px-2 py-1"
          >
            <option value="Asia/Tokyo">Asia/Tokyo（日本）</option>
            <option value="UTC">UTC</option>
          </select>
          {saving && <span className="text-xs text-gray-700">保存中…</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-700">
                <th className="py-1 pr-2">曜日</th>
                <th className="py-1 pr-2">休業</th>
                <th className="py-1 pr-2">時間帯1</th>
                <th className="py-1 pr-2">時間帯2</th>
                <th className="py-1 pr-2">プレビュー</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(DAY_LABEL_JA) as DayKey[]).map((day) => {
                const d = bh.days[day];
                const r1 = d.ranges[0] || { start: "09:00", end: "18:00" };
                const r2 = d.ranges[1];
                return (
                  <tr key={day} className="border-t">
                    <td className="py-2 pr-2">{DAY_LABEL_JA[day]}</td>
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={d.closed}
                        onChange={(e) => toggleDayClosed(day, e.target.checked)}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      {d.closed ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            type="time"
                            value={r1.start}
                            onChange={(e) =>
                              setRange(day, 0, "start", e.target.value)
                            }
                            className="border rounded px-2 py-1"
                          />
                          <span>〜</span>
                          <input
                            type="time"
                            value={r1.end}
                            onChange={(e) =>
                              setRange(day, 0, "end", e.target.value)
                            }
                            className="border rounded px-2 py-1"
                          />
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      {d.closed ? (
                        <span className="text-gray-400">—</span>
                      ) : r2 ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="time"
                            value={r2.start}
                            onChange={(e) =>
                              setRange(day, 1, "start", e.target.value)
                            }
                            className="border rounded px-2 py-1"
                          />
                          <span>〜</span>
                          <input
                            type="time"
                            value={r2.end}
                            onChange={(e) =>
                              setRange(day, 1, "end", e.target.value)
                            }
                            className="border rounded px-2 py-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="h-7 ml-2"
                            onClick={() => removeSecondRange(day)}
                          >
                            2枠目を削除
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-7"
                          disabled={d.closed}
                          onClick={() => addRange(day)}
                        >
                          ＋ 2枠目を追加
                        </Button>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-gray-700">{fmtPreview(d)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div>
          <label className="text-sm block mb-1">
            補足（祝日対応・臨時休業など）
          </label>
          <textarea
            className="w-full border rounded px-3 py-2 text-sm"
            rows={3}
            placeholder="例）祝日は不定期で休業の場合があります。事前にお問い合わせください。"
            value={bh.notes ?? ""}
            onChange={(e) => updateBh({ notes: e.target.value })}
          />
          <p className="mt-1 text-xs text-gray-700">
            ※ AI はここに書かれた注意書きも一緒に案内します。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* =========================
   メニュー設定
========================= */

const MENU_ITEMS: { key: string; label: string }[] = [
  { key: "home", label: "ホーム" },
  { key: "projects", label: "施工実績" },
  { key: "products", label: "商品一覧" },
  { key: "staffs", label: "スタッフ" },
  { key: "pricing", label: "料金" },
  { key: "hours", label: "営業時間" },
  { key: "areas", label: "対応エリア" },
  { key: "stores", label: "店舗一覧" },
  { key: "story", label: "私たちの思い" },
  { key: "blog", label: "取材はこちら" },
  { key: "news", label: "お知らせ" },
  { key: "company", label: "会社概要" },
  { key: "contact", label: "無料相談・お問合せ" },
  { key: "aiChat", label: "AIチャット" }, // ★ 追加
  { key: "reserve", label: "ご予約はこちら" },
  { key: "partners", label: "協力業者募集！" },

  // ▼ EC（追加分）
  { key: "productsEC", label: "オンラインショップ" },
  { key: "cart", label: "カート" },
];

// トップ表示候補は限定（※既存そのまま）★ hours を追加
const TOP_DISPLAYABLE_ITEMS = [
  "products",
  "pricing",
  "staffs",
  "areas",
  "stores",
  "story",
  "news",
  "hours",
];

function SeoGuideCard() {
  return (
    <Card className="shadow-xl bg-white/60 backdrop-blur-sm border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Search size={18} />
          SEO対策の基本とコツ
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 text-sm leading-relaxed text-black">
        <p>
          Pageitは、Googleが評価しやすい構造（高速・軽量・構造化データ対応）で作られています。
          つまり、<strong>「土台のSEO」ではWordPress等の一般的なCMSよりも有利</strong>です。
          残るのは「中身＝運用」です。
        </p>

        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>① 定期的にお知らせ・事例を投稿</strong>
            ：更新頻度があるサイトは検索に強くなります。
          </li>
          <li>
            <strong>② 画像には説明を入れる</strong>
            ：AIやGoogleは画像の内容も理解します。
            ALTテキストやタイトルに「掃除例」「施工事例」などのキーワードを。
          </li>
          <li>
            <strong>③ Googleビジネスに登録</strong>：
            PageitのURLを店舗情報に設定し、「住所・電話・営業時間」を一致させてください（NAP一致）。
          </li>
          <li>
            <strong>④ SNSやLINEからリンク</strong>：
            SNS→ホームページへの導線が増えるとSEOの信頼性が上がります。
          </li>
          <li>
            <strong>⑤ 地域名＋サービス名を意識</strong>：
            「豊中市　ハウスクリーニング」など、検索されやすい組み合わせをタイトルや説明に。
          </li>
        </ul>

        <p>
          これらを継続するだけで、自然と検索順位が安定して上がっていきます。
          Pageitの構造はその努力を最大限活かせるように設計されています。
        </p>
      </CardContent>
    </Card>
  );
}

/* =========================
   ページ本体
========================= */
export default function LoginPage() {
  const [theme, setTheme] = useState<ThemeKey>("brandA");
  const [visibleKeys, setVisibleKeys] = useState<string[]>(
    MENU_ITEMS.map((m) => m.key)
  );
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);

  // --- i18n 設定 ---
  const [i18nEnabled, setI18nEnabled] = useState<boolean>(true);
  const [uiLangs, setUiLangs] = useState<UILang[]>(["ja" as UILang]); // 既定は日本語のみ

  // auth form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // modals
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showForgotEmail, setShowForgotEmail] = useState(false);

  // Google / address UI states
  const [gmapsReady, setGmapsReady] = useState(false);
  const addrInputRef = useRef<HTMLInputElement | null>(null);

  // EC: Connect（Stripe連携）完了状態
  const [hasConnect, setHasConnect] = useState(false);

  // 営業時間の有効/無効（購読で同期）
  const [bhEnabled, setBhEnabled] = useState<boolean>(false);

  const [guideAccepted, setGuideAccepted] = useState<boolean>(false);
  const [guideAcceptedAt, setGuideAcceptedAt] = useState<any>(null);

  // Google Maps API Key
  const mapsApiKey = useMemo(
    () => process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    []
  );

  /* ---------------- 初期ロード（サイト設定） ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(META_REF);
        if (!snap.exists()) return;
        const data = snap.data() as any;

        if (data.themeGradient) setTheme(data.themeGradient as ThemeKey);
        if (Array.isArray(data.visibleMenuKeys))
          setVisibleKeys(data.visibleMenuKeys);
        if (Array.isArray(data.activeMenuKeys))
          setActiveKeys(data.activeMenuKeys);

        // i18n
        const enabled =
          typeof data.i18n?.enabled === "boolean" ? data.i18n!.enabled! : true;
        setI18nEnabled(enabled);

        const langs = Array.isArray(data.i18n?.langs)
          ? (data.i18n!.langs as UILang[])
          : (["ja"] as UILang[]);
        // 常に ja は含める
        setUiLangs(() => {
          const s = new Set<UILang>(
            langs.length ? langs : (["ja"] as UILang[])
          );
          s.add("ja" as UILang);
          return Array.from(s);
        });
      } catch (e) {
        console.error("初期データ取得失敗:", e);
      }
    })();
  }, []);

  /* ---------------- 営業時間ON/OFFの購読（トップ表示の抑止のみ） ---------------- */
  useEffect(() => {
    const unsub = onSnapshot(META_REF, (snap) => {
      const data = (snap.data() as any) || {};
      const enabled = data?.businessHours?.enabled === true;
      setBhEnabled(enabled);

      if (!enabled) {
        // OFF時: トップ表示（activeKeys）からは必ず外す
        setActiveKeys((prev) => {
          if (!prev.includes("hours")) return prev;
          const next = prev.filter((k) => k !== "hours");
          setDoc(META_REF, { activeMenuKeys: next }, { merge: true }).catch(
            console.error
          );
          return next;
        });
      }
    });
    return () => unsub();
  }, []);

  /* ---------------- Connect 状態（EC可否） ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/sellers/connect-status?siteKey=${encodeURIComponent(SITE_KEY)}`
        );
        const data: any = await res.json();
        const completed = data?.status === "completed";
        setHasConnect(!!completed);

        // 未連携なら候補UIからショップ & カートを一時的に隠す（Firestoreには書かない）
        if (!completed) {
          setVisibleKeys((prev) =>
            prev.filter((k) => k !== "productsEC" && k !== "cart")
          );
        }
      } catch {
        setHasConnect(false);
        setVisibleKeys((prev) =>
          prev.filter((k) => k !== "productsEC" && k !== "cart")
        );
      }
    })();
  }, []);

  /* ---------------- 認証（オーナー判定） ---------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "siteSettings", SITE_KEY));
        if (!snap.exists()) {
          setError("サイト情報が見つかりません。");
          await signOut(auth);
          return;
        }
        const data = snap.data();
        if ((data as any).ownerId !== firebaseUser.uid) {
          setError("このアカウントには管理権限がありません。");
          await signOut(auth);
          return;
        }
        setUser(firebaseUser);
      } catch (e) {
        console.error(e);
        setError("権限確認中にエラーが発生しました。");
        await signOut(auth);
      }
    });
    return () => unsub();
  }, []);

  /* ---------------- ログイン/ログアウト ---------------- */
  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case "auth/invalid-email":
            setError("メールアドレスの形式が正しくありません。");
            break;
          case "auth/user-not-found":
            setError("このメールアドレスは登録されていません。");
            break;
          case "auth/wrong-password":
            setError("パスワードが間違っています。");
            break;
          default:
            setError("ログインに失敗しました。");
        }
      } else {
        setError("不明なエラーが発生しました。");
      }
    } finally {
      setLoading(false);
    }
  };

  // ▼ 追加：オーナー同意の購読
  useEffect(() => {
    const unsub = onSnapshot(SELLER_REF, (snap) => {
      const d = (snap.data() as any) || {};
      setGuideAccepted(!!d?.ecGuideAcceptedAt);
      setGuideAcceptedAt(d?.ecGuideAcceptedAt || null);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/owner/session", { method: "DELETE" }).catch(() => {});
    await signOut(auth);
  };

  const canShowEC = hasConnect && guideAccepted;

  // ▼ 追加：条件を満たさない間は候補からECを外す（見た目の一貫性）
  useEffect(() => {
    if (!canShowEC) {
      setVisibleKeys((prev) =>
        prev.filter((k) => k !== "productsEC" && k !== "cart")
      );
    }
  }, [canShowEC]);

  /* ---------------- Firestore 更新関数 ---------------- */
  const handleThemeChange = async (newTheme: ThemeKey) => {
    setTheme(newTheme);
    await setDoc(META_REF, { themeGradient: newTheme }, { merge: true });
  };

  const handleVisibleKeysChange = async (newKeys: string[]) => {
    setVisibleKeys(newKeys);
    await setDoc(META_REF, { visibleMenuKeys: newKeys }, { merge: true });

    // ★ ここで active も同期（候補外は落とす）
    setActiveKeys((prev) => {
      const next = prev.filter((k) => newKeys.includes(k));
      if (next.length !== prev.length) {
        setDoc(META_REF, { activeMenuKeys: next }, { merge: true }).catch(
          console.error
        );
      }
      return next;
    });
  };

  const handleActiveKeysChange = async (newKeys: string[]) => {
    setActiveKeys(newKeys);
    await setDoc(META_REF, { activeMenuKeys: newKeys }, { merge: true });
  };

  // i18n: 有効/無効
  const handleI18nEnabledChange = async (next: boolean) => {
    setI18nEnabled(next);
    await setDoc(
      META_REF,
      { i18n: { enabled: next, langs: uiLangs } },
      { merge: true }
    );
  };

  // i18n: 言語トグル（ja は外せない）
  const handleLangToggle = async (lang: UILang, checked: boolean) => {
    setUiLangs((prev) => {
      const set = new Set<UILang>(prev);
      if (lang === "ja") {
        set.add("ja" as UILang);
      } else {
        if (checked) set.add(lang);
        else set.delete(lang);
      }
      const next = Array.from(set);
      setDoc(
        META_REF,
        { i18n: { enabled: i18nEnabled, langs: next } },
        { merge: true }
      ).catch(console.error);
      return next;
    });
  };

  const handleSelectAllLangs = async () => {
    const all = Array.from(
      new Set<UILang>(["ja", ...(LANGS.map((l: any) => l.key) as UILang[])])
    );
    const next = all as UILang[];
    setUiLangs(next);
    await setDoc(
      META_REF,
      { i18n: { enabled: i18nEnabled, langs: next } },
      { merge: true }
    );
  };

  const handleClearAllLangsExceptJa = async () => {
    const next = ["ja"] as UILang[];
    setUiLangs(next);
    await setDoc(
      META_REF,
      { i18n: { enabled: i18nEnabled, langs: next } },
      { merge: true }
    );
  };

  // ▼ EC可否トグル時に seller の onboardingCompleted を即時反映
  const setOnboardingCompleted = async (next: boolean) => {
    if (!guideAccepted) {
      alert("先に「ECご利用前ガイド」で同意してください。");
      throw new Error("ec-guide-not-accepted");
    }
    const user = auth.currentUser;
    if (!user) throw new Error("not-signed-in");
    const token = await user.getIdToken();

    const res = await fetch("/api/sellers/onboarding-completed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ siteKey: SITE_KEY, completed: next }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new Error(j?.error || `HTTP ${res.status}`);
    }
  };

  /* ---------------- Google Maps Places 初期化 ---------------- */
  useEffect(() => {
    if (!mapsApiKey) return;
    const loader = new Loader({
      apiKey: mapsApiKey,
      version: "weekly",
      libraries: ["places"],
    });
    loader
      .load()
      .then(() => setGmapsReady(true))
      .catch(console.error);
  }, [mapsApiKey]);

  // 住所オートコンプリート
  useEffect(() => {
    if (!gmapsReady || !addrInputRef.current || !(window as any).google) return;
    const ac = new google.maps.places.Autocomplete(addrInputRef.current!, {
      fields: ["formatted_address", "geometry", "address_components"],
      componentRestrictions: { country: ["jp"] },
    });
    ac.addListener("place_changed", async () => {
      const place = ac.getPlace();
      const loc = place.geometry?.location;
      if (!loc) return;
      const latV = loc.lat();
      const lngV = loc.lng();
      const comps = place.address_components || [];
      const get = (t: string) =>
        comps.find((c) => c.types.includes(t))?.long_name || "";
      const region = get("administrative_area_level_1");
      const locality =
        get("locality") ||
        get("sublocality") ||
        get("administrative_area_level_2");
      const postalCode = get("postal_code");
      const formatted = place.formatted_address || "";
      const street = formatted.replace(region, "").replace(locality, "").trim();

      await updateDoc(META_REF, {
        address: {
          postalCode: postalCode || "",
          region: region || "",
          locality: locality || "",
          street: street || formatted,
          countryCode: "JP",
          lat: latV,
          lng: lngV,
        },
      });
    });
  }, [gmapsReady]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      {user ? (
        <>
          {showChangePassword ? (
            <div className="w-full max-w-md">
              <ChangePassword onClose={() => setShowChangePassword(false)} />
            </div>
          ) : (
            <div className="w-full max-w-5xl space-y-6">
              {/* 表示設定 */}
              <Card className="shadow-xl bg-white/50">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    表示設定
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ImageLogoControls
                    siteKey={SITE_KEY}
                    onProgress={(p) => console.log(p)}
                    onDone={(type, url) => console.log("done:", type, url)}
                  />

                  <div>
                    <SectionTitle>テーマカラー</SectionTitle>
                    <ThemeSelector
                      currentTheme={theme}
                      onChange={handleThemeChange}
                    />
                  </div>

                  <div>
                    <SectionTitle>フォント</SectionTitle>
                    <FontSwitcher />
                  </div>

                  {/* 候補チェック */}
                  <div>
                    <SectionTitle>メニュー候補の設定</SectionTitle>

                    {/* ▼ ECまとめチェック（ショップ & カート） */}
                    <div className="mb-3">
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          disabled={!canShowEC} // ★ Stripe完了 & 同意済みでなければ押せない
                          checked={
                            visibleKeys.includes("productsEC") &&
                            visibleKeys.includes("cart")
                          }
                          onChange={async (e) => {
                            // ★ 二重ガード：未条件時はガイドページへ誘導
                            if (!canShowEC) {
                              window.open("/owner-ec-guide", "_blank");
                              return;
                            }

                            const checked = e.target.checked;

                            try {
                              // サーバー側状態の更新（既存）
                              await setOnboardingCompleted(checked);
                            } catch (err) {
                              console.error(
                                "Failed to toggle onboardingCompleted:",
                                err
                              );
                              alert(
                                "販売状態の更新に失敗しました。もう一度お試しください。"
                              );
                              return;
                            }

                            setVisibleKeys((prev) => {
                              const base = new Set(prev);
                              base.delete("productsEC");
                              base.delete("cart");
                              if (checked) {
                                base.add("productsEC");
                                base.add("cart");
                              }
                              const next = Array.from(base);
                              handleVisibleKeysChange(next); // Firestoreへ反映
                              return next;
                            });
                          }}
                        />
                        <div className={!canShowEC ? "opacity-60" : ""}>
                          <div>ネット販売（ショップ & カート）</div>
                          {!hasConnect && (
                            <div className="text-xs text-black">
                              Stripe連携が完了すると選択できます。
                            </div>
                          )}
                          {hasConnect && !guideAccepted && (
                            <div className="text-xs text-black">
                              まず{" "}
                              <a
                                className="underline text-blue-600"
                                href="/owner-ec-guide"
                                target="_blank"
                              >
                                ECご利用前ガイド
                              </a>
                              で同意してください（同意日時が記録されます）。
                            </div>
                          )}
                          {guideAcceptedAt && (
                            <div className="text-[11px] text-black">
                              同意済み：
                              {String(
                                new Date(
                                  guideAcceptedAt.toDate?.() ?? guideAcceptedAt
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </label>
                    </div>

                    {/* その他の候補（ECの2項目＋営業時間は除外） */}
                    <div className="space-y-1">
                      {MENU_ITEMS.filter(
                        (item) =>
                          !["productsEC", "cart", "hours"].includes(item.key) // ← 追加
                      ).map((item) => (
                        <label
                          key={item.key}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={visibleKeys.includes(item.key)}
                            onChange={(e) => {
                              const newKeys = e.target.checked
                                ? [...visibleKeys, item.key]
                                : visibleKeys.filter((k) => k !== item.key);
                              handleVisibleKeysChange(newKeys);
                            }}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* トップに表示するもの（限定） */}
                  <div>
                    <SectionTitle>トップに表示するもの</SectionTitle>
                    <div className="space-y-1">
                      {MENU_ITEMS.filter((item) =>
                        TOP_DISPLAYABLE_ITEMS.includes(item.key)
                      ).map((item) => {
                        const isHours = item.key === "hours";
                        const disabled = isHours
                          ? !bhEnabled // ← hours は時間設定ONでのみ選択可
                          : !visibleKeys.includes(item.key); // ← 他は従来どおり候補にある時だけ
                        return (
                          <label
                            key={item.key}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              disabled={disabled}
                              checked={activeKeys.includes(item.key)}
                              onChange={(e) => {
                                const newKeys = e.target.checked
                                  ? [...activeKeys, item.key]
                                  : activeKeys.filter((k) => k !== item.key);
                                handleActiveKeysChange(newKeys);
                              }}
                            />
                            {item.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 多言語設定（日本語表記ラベル） */}
              <I18nSettingsCard
                enabled={i18nEnabled}
                langs={uiLangs}
                onToggleEnabled={handleI18nEnabledChange}
                onToggleLang={handleLangToggle}
                onSelectAll={handleSelectAllLangs}
                onClearAll={handleClearAllLangsExceptJa}
              />

              <BusinessHoursCard />

              {/* Stripe Connect 連携カード */}
              <StripeConnectCard />



              {/* Ship&co への導線（Stripeの近くに設置） */}
              {hasConnect && <ShipAndCoLinkCard />}

               <SeoGuideCard />

              {/* アカウント操作（※既存そのまま） */}
              <Card className="shadow-xl bg白/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                    <LogOut size={20} /> ログアウト
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                  <p>{user?.email} としてログイン中です。</p>
                  <button
                    onClick={() => setShowChangePassword(true)}
                    className="text-blue-500 hover:underline"
                  >
                    パスワードを変更
                  </button>
                  <Button onClick={handleLogout} className="w-full bg-blue-500">
                    ログアウト
                  </Button>
                </CardContent>
              </Card>


            </div>
          )}
        </>
      ) : (
        // 未ログインビュー
        <div className="w-full max-w-md">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <LucideLogIn size={20} /> 管理者ログイン
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>ログインエラー</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Input
                type="email"
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => {
                    setShowForgotEmail(false);
                    setShowForgotPassword(true);
                  }}
                  className="text-blue-500 hover:underline"
                >
                  パスワードを忘れた方
                </button>
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setShowForgotEmail(true);
                  }}
                  className="text-blue-500 hover:underline"
                >
                  メールアドレスを忘れた方
                </button>
              </div>
              <Button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-blue-500"
              >
                {loading ? "ログイン中..." : "ログイン"}
              </Button>
            </CardContent>
          </Card>

          {/* モーダル */}
          {showForgotPassword && (
            <div className="fixed inset-0 z-50 bg黒/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <ForgotPassword onClose={() => setShowForgotPassword(false)} />
              </div>
            </div>
          )}
          {showForgotEmail && (
            <div className="fixed inset-0 z-50 bg黒/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <ForgotEmail
                  onClose={() => setShowForgotEmail(false)}
                  onEmailFound={(found) => {
                    setEmail(found);
                    setShowForgotEmail(false);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
