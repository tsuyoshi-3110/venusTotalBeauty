// app/business-card/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { site } from "@/config/site";
import { db } from "@/lib/firebase";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import {
  collection,
  doc,
  onSnapshot,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { Store, X } from "lucide-react";

/* ========== 型 ========== */
type Contact = {
  name: string; // ownerName
  company?: string; // siteName
  email?: string; // ownerEmail
  phone?: string; // ownerPhone（上部に表示）
  url?: string; // QRにするURL
  ownerAddress?: string; // siteSettings の住所（拠点が無い時フォールバック）
};

type SiteDoc = Partial<{
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerAddress: string;
  siteName: string;
}> | null;

type StoreItem = {
  id?: string;
  name?: string;
  address?: string;
  order?: number;
  phone?: string; // 店舗TEL（任意）
  isMain?: boolean; // 本店フラグ
};

function readStore(s: QueryDocumentSnapshot): StoreItem {
  const d = s.data() as any;
  return {
    id: s.id,
    name:
      typeof d?.name === "string"
        ? d.name
        : typeof d?.storeName === "string"
        ? d.storeName
        : undefined,
    address: typeof d?.address === "string" ? d.address : undefined,
    order: typeof d?.order === "number" ? d.order : 9_999,
    phone:
      typeof d?.phone === "string" && d.phone.trim()
        ? d.phone.trim()
        : undefined,
    isMain: !!d?.isMain,
  };
}

/* 住所→GoogleマップURL */
function mapsUrl(addr: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    addr
  )}`;
}

/* ========== 共有テキスト / vCard 生成 ========== */
function buildShareText(c: Contact, stores: StoreItem[]) {
  const lines: string[] = [];
  if (c.company) lines.push(c.company);
  if (c.name) lines.push(c.name);

  if (c.phone) lines.push(`TEL: ${c.phone}`);
  if (c.email) lines.push(`MAIL: ${c.email}`);

  if (stores.length > 0) {
    lines.push("拠点:");
    for (const s of stores) {
      if (!s.address && !s.name) continue;
      const head = s.name ? `${s.name}: ` : "";
      const addr = s.address ?? "";
      lines.push(`・${head}${addr}`);
      if (s.phone?.trim()) lines.push(`  TEL: ${s.phone.trim()}`);
      if (addr) lines.push(`  MAP: ${mapsUrl(addr)}`);
    }
  } else if (c.ownerAddress) {
    lines.push(`ADDR: ${c.ownerAddress}`);
    if (c.phone) lines.push(`TEL: ${c.phone}`);
    lines.push(`MAP: ${mapsUrl(c.ownerAddress)}`);
  }

  if (c.url) lines.push(`URL: ${c.url}`);
  return lines.join("\n");
}

function escVCard(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function buildVCard(c: Contact, stores: StoreItem[]) {
  const displayName = c.name || "";
  const [last, first] = displayName.includes(" ")
    ? displayName.split(" ")
    : [displayName, ""];

  const single = stores.length === 1 ? stores[0] : null;

  // ★ 優先電話番号：店舗 → サイト（owner/代表）
  const preferredPhone =
    (single?.phone && single.phone.trim()) || (c.phone && c.phone.trim()) || "";

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escVCard(last)};${escVCard(first)};;;`,
    `FN:${escVCard(displayName)}`,
  ];

  // 会社名のみ（部署は入れない）
  if (c.company) lines.push(`ORG:${escVCard(c.company)}`);

  // 単一店舗のときだけ TITLE に店舗名
  if (single?.name) lines.push(`TITLE:${escVCard(single.name)}`);

  // ★ TEL は優先電話番号を使用（空なら出力しない）
  if (preferredPhone) lines.push(`TEL;TYPE=CELL,VOICE:${escVCard(preferredPhone)}`);

  if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${escVCard(c.email)}`);
  if (c.url) lines.push(`URL:${escVCard(c.url)}`);

  // 住所は LABEL なしで純住所だけ
  if (stores.length > 0) {
    for (const s of stores) {
      if (s.address) lines.push(`ADR;TYPE=WORK:;;${escVCard(s.address)};;;;`);
    }
  } else if (c.ownerAddress) {
    lines.push(`ADR;TYPE=WORK:;;${escVCard(c.ownerAddress)};;;;`);
  }

  lines.push("END:VCARD");
  return lines.join("\r\n");
}




/* vCardテキスト→File */
function buildVCardFile(c: Contact, stores: StoreItem[]) {
  const text = buildVCard(c, stores);
  return new File([text], `${c.name || "contact"}.vcf`, {
    type: "text/vcard;charset=utf-8",
  });
}

/* 共有非対応環境向け：ダウンロードにフォールバック */
function downloadVCardFile(file: File, anchorEl: HTMLAnchorElement | null) {
  if (!anchorEl) return;
  const url = URL.createObjectURL(file);
  anchorEl.href = url;
  anchorEl.download = file.name;
  anchorEl.click();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

/* ========== ページ本体 ========== */
export default function BusinessCardPage() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pageUrl = site?.baseUrl || origin || "https://example.com";

  const [editable, setEditable] = useState<SiteDoc>(null);
  const [base, setBase] = useState<SiteDoc>(null);
  const [stores, setStores] = useState<StoreItem[]>([]);

  // vCard ピッカー（センター表示）
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    const unsubEditable = onSnapshot(
      doc(db, "siteSettingsEditable", SITE_KEY),
      (s) => setEditable(s.exists() ? (s.data() as SiteDoc) : null),
      (e) => console.warn("siteSettingsEditable read error:", e)
    );
    const unsubBase = onSnapshot(
      doc(db, "siteSettings", SITE_KEY),
      (s) => setBase(s.exists() ? (s.data() as SiteDoc) : null),
      (e) => console.warn("siteSettings read error:", e)
    );
    const unsubStores = onSnapshot(
      collection(db, "siteStores", SITE_KEY, "items"),
      (snap) => {
        const arr = snap.docs
          .map(readStore)
          .filter((x) => x.address || x.name)
          .sort(
            (a, b) =>
              (a.order ?? 9_999) - (b.order ?? 9_999) ||
              (a.name ?? "").localeCompare(b.name ?? "", "ja")
          );
        setStores(arr);
        const main = arr.find((s) => s.isMain);
        setSelectedId(main?.id ?? arr[0]?.id ?? "");
      },
      (e) => console.warn("siteStores read error:", e)
    );

    return () => {
      unsubEditable();
      unsubBase();
      unsubStores();
    };
    // SITE_KEY は定数のため依存に含めない
  }, []);

  // Escで閉じる
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setPickerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen]);

  // 上部の表示用（サイトの代表TEL等）
  const contact: Contact = useMemo(() => {
    const e = editable ?? {};
    const b = base ?? {};
    const str = (v: any, def = "") =>
      typeof v === "string" ? v : v == null ? def : String(v);
    return {
      name: str(e.ownerName ?? b.ownerName, "－").trim(),
      company: str(e.siteName ?? b.siteName ?? site?.name ?? "Pageit").trim(),
      email: str(e.ownerEmail ?? b.ownerEmail).trim(),
      phone: str(e.ownerPhone ?? b.ownerPhone).trim(),
      url: pageUrl,
      ownerAddress: str(e.ownerAddress ?? b.ownerAddress).trim(),
    };
  }, [editable, base, pageUrl]);

  // 拠点リスト（なければサイト住所1件を代替）
  const storeList: StoreItem[] = useMemo(() => {
    if (stores.length > 0) return stores;
    if (contact.ownerAddress)
      return [
        { name: contact.company, address: contact.ownerAddress, order: 0 },
      ];
    return [];
  }, [stores, contact.ownerAddress, contact.company]);

  const shareText = useMemo(
    () => buildShareText(contact, storeList),
    [contact, storeList]
  );

  // vCard共有（共有非対応はDLフォールバック）
  const vcfAnchorRef = useRef<HTMLAnchorElement | null>(null);
  const shareVCard = async (targets?: StoreItem[]) => {
    const targetsFinal = targets && targets.length > 0 ? targets : storeList;
    const file = buildVCardFile(contact, targetsFinal);

    const canShareFiles =
      typeof navigator !== "undefined" &&
      typeof (navigator as any).canShare === "function" &&
      (navigator as any).canShare({ files: [file] });

    if (canShareFiles) {
      try {
        await (navigator as any).share({
          files: [file],
          title: `${contact.company ?? ""} ${contact.name ?? ""}`.trim(),
          text: "連絡先カードを共有します。",
        });
        return;
      } catch {
        // ユーザーキャンセルや例外はフォールバックへ
      }
    }
    downloadVCardFile(file, vcfAnchorRef.current);
  };

  // クリック時分岐（複数店舗→ピッカー）
  const handleVcfClick = () => {
    if (storeList.length === 0) {
      shareVCard();
      return;
    }
    if (storeList.length === 1) {
      shareVCard([storeList[0]]);
      return;
    }
    setPickerOpen(true);
  };

  const lineTextUrl = `line://msg/text/${encodeURIComponent(shareText)}`;
  const mailto = `mailto:?subject=${encodeURIComponent(
    `${contact.company ?? ""} ${contact.name ?? ""}`
  )}&body=${encodeURIComponent(shareText)}`;

  return (
    <div className="min-h-screen bg-gradient-to-b mt-10 dark:from-neutral-900 dark:to-neutral-950">
      <div className="mx-auto max-w-3xl p-6">
        <Card className="shadow-xl border-0 bg-white/50">
          <CardHeader className="pb-2">
            {contact.company && (
              <p className="text-2xl font-bold leading-tight">
                {contact.company}
              </p>
            )}
            <h2 className="text-lg mt-2 leading-tight">{contact.name}</h2>
          </CardHeader>

          <CardContent>
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div className="space-y-3">
                <div className="pt-2 text-sm space-y-1">
                  {contact.phone && (
                    <p>
                      <span className="inline-block w-14 opacity-60">TEL</span>
                      <a
                        href={`tel:${contact.phone}`}
                        className="underline underline-offset-2"
                      >
                        {contact.phone}
                      </a>
                    </p>
                  )}
                  {contact.email && (
                    <p>
                      <span className="inline-block w-14 opacity-60">MAIL</span>
                      <a
                        href={`mailto:${contact.email}`}
                        className="underline underline-offset-2"
                      >
                        {contact.email}
                      </a>
                    </p>
                  )}
                  <p>
                    <span className="inline-block w-14 opacity-60">WEB</span>
                    <a
                      href={contact.url}
                      target="_blank"
                      className="underline underline-offset-2"
                    >
                      {contact.url}
                    </a>
                  </p>

                  {storeList.length > 0 && (
                    <div className="pt-2">
                      <p className="opacity-60 text-xs mb-1">拠点</p>
                      <ul className="list-disc ml-5 space-y-1">
                        {storeList.map((s, i) => {
                          const phone = s.phone?.trim() || "";
                          return (
                            <li
                              key={`${s.id ?? s.name ?? "store"}-${i}`}
                              className="text-sm"
                            >
                              {s.name ? (
                                <span className="font-medium">{s.name}：</span>
                              ) : null}
                              <span>{s.address}</span>
                              {phone && (
                                <div className="mt-0.5">
                                  <span className="opacity-60 mr-1">TEL</span>
                                  <a
                                    href={`tel:${phone}`}
                                    className="underline underline-offset-2"
                                  >
                                    {phone}
                                  </a>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-4">
                  {/* LINE/メールは一覧テキストをそのまま共有 */}
                  <a href={lineTextUrl} className="inline-block">
                    <Button variant="secondary" className="rounded-2xl">
                      LINEで送る
                    </Button>
                  </a>
                  <a href={mailto} className="inline-block">
                    <Button variant="secondary" className="rounded-2xl">
                      メールで送る
                    </Button>
                  </a>

                  {/* vCardは共有（非対応はDLフォールバック） */}
                  <Button
                    variant="secondary"
                    onClick={handleVcfClick}
                    className="rounded-2xl"
                  >
                    vCardをシェア
                  </Button>
                  <a ref={vcfAnchorRef} className="hidden" aria-hidden />
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-4 py-6">
                <div className="bg-white dark:bg-neutral-800 p-5 rounded-2xl shadow">
                  <QRCode value={contact.url ?? pageUrl} size={196} />
                </div>
                <p className="text-sm text-muted-foreground text-center">URL</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ====== ピッカーモーダル（日本語・センター表示） ====== */}
      {pickerOpen && storeList.length > 1 && (
        <div className="fixed inset-0 z-[100] grid place-items-center">
          {/* 背景 */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setPickerOpen(false)}
            aria-hidden="true"
          />
          {/* 本体 */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="store-picker-title"
            className="relative z-10 w-[92vw] max-w-md rounded-2xl bg-white/70 p-4 text-black shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 id="store-picker-title" className="flex items-center gap-2">
                <Store className="h-4 w-4 text-black" />
                店舗を選択
              </h3>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label="閉じる"
                className="rounded-md p-1 hover:bg-black/5"
                title="閉じる"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <select
              className="w-full rounded-md border bg-white p-2 text-black"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              aria-label="店舗を選択"
            >
              {storeList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isMain ? "（本店）" : ""}
                </option>
              ))}
            </select>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                onClick={() => {
                  if (!selectedId) return;
                  setPickerOpen(false);
                  const st = storeList.find((s) => s.id === selectedId);
                  shareVCard(st ? [st] : undefined);
                }}
                disabled={!selectedId}
                title="選択した店舗を共有"
                aria-label="選択した店舗を共有"
              >
                選択した店舗をシェア
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
