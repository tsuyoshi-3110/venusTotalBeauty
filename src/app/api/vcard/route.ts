// app/api/vcard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { site } from "@/config/site";

export const dynamic = "force-dynamic";

/** vCard用エスケープ */
function esc(text: string) {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/** 単一連絡先のvCard（vCard 3.0） */
function buildVCard(opts: {
  ownerName: string; // 表示名（店舗名 or オーナー名）
  siteName: string;  // ORGに入れる（サイト名）
  phone?: string;
  email?: string;
  address?: string;
  url?: string;
}) {
  const displayName = opts.ownerName || opts.siteName || "Contact";
  const [last, first] = displayName.includes(" ")
    ? displayName.split(" ")
    : [displayName, ""];

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(first)};;;`,
    `FN:${esc(displayName)}`,
    opts.siteName ? `ORG:${esc(opts.siteName)}` : "",
    opts.phone ? `TEL;TYPE=CELL,VOICE:${esc(opts.phone)}` : "",
    opts.email ? `EMAIL;TYPE=INTERNET:${esc(opts.email)}` : "",
    opts.url ? `URL:${esc(opts.url)}` : "",
    opts.address ? `ADR;TYPE=WORK:;;${esc(opts.address)};;;;` : "",
    "END:VCARD",
  ].filter(Boolean);

  return lines.join("\r\n"); // vCardはCRLFが相性良い
}

type StoreDoc = {
  id: string;
  name?: string;
  phone?: string;
  address?: string;
  email?: string;
  isMain?: boolean;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storeIdParam = searchParams.get("storeId"); // "id1,id2"
  const mainOnly = searchParams.get("main") === "true";
  const nameParam = searchParams.get("name"); // 単一名マッチ

  // Editable優先 → Baseフォールバック（“一般向け”想定）
  const [storesSnap, eSnap, bSnap] = await Promise.all([
    adminDb.collection("siteStores").doc(SITE_KEY).collection("items").get(),
    adminDb.doc(`siteSettingsEditable/${SITE_KEY}`).get(),
    adminDb.doc(`siteSettings/${SITE_KEY}`).get(),
  ]);

  const e = (eSnap.exists ? (eSnap.data() as any) : {}) || {};
  const b = (bSnap.exists ? (bSnap.data() as any) : {}) || {};

  const siteName: string = (e.siteName ?? b.siteName ?? site.name ?? "Pageit").trim();
  const ownerName: string = (e.ownerName ?? b.ownerName ?? "").trim();
  const ownerPhone: string = (e.ownerPhone ?? b.ownerPhone ?? "").trim();
  const ownerEmail: string = (e.ownerEmail ?? b.ownerEmail ?? "").trim();
  const ownerAddress: string = (e.ownerAddress ?? b.ownerAddress ?? "").trim();
  const baseUrl: string = site.baseUrl;

  // 全店舗を一旦取得（通常は件数が少ないので十分軽量）
  let stores: StoreDoc[] = [];
  storesSnap.forEach((doc) => {
    const d = (doc.data() as any) ?? {};
    const s: StoreDoc = {
      id: doc.id,
      name: (d.name ?? d.storeName ?? "").trim(),
      phone: (d.phone ?? "").trim(),
      address: (d.address ?? "").trim(),
      email: (d.email ?? "").trim(),
      isMain: Boolean(d.isMain),
    };
    if (s.name || s.phone || s.address || s.email) {
      stores.push(s);
    }
  });

  // --- クエリパラメータでの絞り込み ---
  if (storeIdParam) {
    const wantIds = storeIdParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    stores = stores.filter((s) => wantIds.includes(s.id));
  } else if (mainOnly) {
    const main = stores.find((s) => s.isMain);
    stores = main ? [main] : [];
  } else if (nameParam) {
    const key = nameParam.trim();
    stores = stores.filter((s) => (s.name ?? "") === key);
  }
  // -------------------------------

  let vcf = "";
  let filename = "contact.vcf";

  if (stores.length > 0) {
    const cards = stores.map((s) =>
      buildVCard({
        ownerName: s.name || siteName,
        siteName,
        phone: s.phone,
        email: s.email,
        address: s.address,
        url: baseUrl,
      })
    );
    vcf = cards.join("\r\n");
    filename =
      stores.length === 1
        ? `${encodeURIComponent(stores[0].name || siteName)}.vcf`
        : "contacts.vcf";
  } else {
    // 該当店舗が無い場合は、オーナー情報1件を返す（後方互換）
    const base = ownerName || siteName || "contact";
    vcf = buildVCard({
      ownerName: ownerName || siteName,
      siteName,
      phone: ownerPhone,
      email: ownerEmail,
      address: ownerAddress,
      url: baseUrl,
    });
    filename = `${encodeURIComponent(base)}.vcf`;
  }

  return new NextResponse(vcf, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
