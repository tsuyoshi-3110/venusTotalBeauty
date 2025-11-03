// components/common/VCardDownloadButton.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, Store, X } from "lucide-react";
import { useUILang, type UILang } from "@/lib/atoms/uiLangAtom";

/* =========================
   I18N
========================= */
type Dict = {
  label: string;          // メインボタン「連絡先を保存」
  ariaSave: string;       // ボタンのaria/タイトル
  modalTitle: string;     // モーダル見出し
  mainOnly: string;       // 「本店だけ」
  saveSelected: string;   // 「選択した店舗を保存」
  close: string;          // 「閉じる」
  mainBadge: string;      // 「（本店）」のバッジ表記
  dir: "ltr" | "rtl";
};

const JA = "ja" as UILang;

const I18N: Record<UILang, Dict> = {
  ja: { label: "連絡先を保存", ariaSave: "連絡先を保存", modalTitle: "店舗を選択してダウンロード", mainOnly: "本店だけ", saveSelected: "選択した店舗を保存", close: "閉じる", mainBadge: "（本店）", dir: "ltr" },
  en: { label: "Save contact(s)", ariaSave: "Save contact(s)", modalTitle: "Select a store to download", mainOnly: "Main store only", saveSelected: "Save selected store", close: "Close", mainBadge: " (Main)", dir: "ltr" },
  zh: { label: "保存联系人", ariaSave: "保存联系人", modalTitle: "选择门店以下载", mainOnly: "仅主店", saveSelected: "保存所选门店", close: "关闭", mainBadge: "（主店）", dir: "ltr" },
  "zh-TW": { label: "儲存聯絡人", ariaSave: "儲存聯絡人", modalTitle: "選擇門市以下載", mainOnly: "僅主店", saveSelected: "儲存所選門市", close: "關閉", mainBadge: "（主店）", dir: "ltr" },
  ko: { label: "연락처 저장", ariaSave: "연락처 저장", modalTitle: "다운로드할 매장을 선택하세요", mainOnly: "본점만", saveSelected: "선택한 매장 저장", close: "닫기", mainBadge: " (본점)", dir: "ltr" },
  fr: { label: "Enregistrer le contact", ariaSave: "Enregistrer le contact", modalTitle: "Sélectionnez un magasin à télécharger", mainOnly: "Magasin principal uniquement", saveSelected: "Enregistrer la boutique sélectionnée", close: "Fermer", mainBadge: " (principal)", dir: "ltr" },
  es: { label: "Guardar contacto", ariaSave: "Guardar contacto", modalTitle: "Selecciona una tienda para descargar", mainOnly: "Solo tienda principal", saveSelected: "Guardar tienda seleccionada", close: "Cerrar", mainBadge: " (principal)", dir: "ltr" },
  de: { label: "Kontakt speichern", ariaSave: "Kontakt speichern", modalTitle: "Wähle ein Geschäft zum Herunterladen", mainOnly: "Nur Hauptgeschäft", saveSelected: "Ausgewähltes Geschäft speichern", close: "Schließen", mainBadge: " (Hauptgeschäft)", dir: "ltr" },
  pt: { label: "Salvar contato", ariaSave: "Salvar contato", modalTitle: "Selecione a loja para baixar", mainOnly: "Apenas loja principal", saveSelected: "Salvar loja selecionada", close: "Fechar", mainBadge: " (principal)", dir: "ltr" },
  it: { label: "Salva contatto", ariaSave: "Salva contatto", modalTitle: "Seleziona un negozio da scaricare", mainOnly: "Solo sede principale", saveSelected: "Salva negozio selezionato", close: "Chiudi", mainBadge: " (sede principale)", dir: "ltr" },
  ru: { label: "Сохранить контакт", ariaSave: "Сохранить контакт", modalTitle: "Выберите магазин для загрузки", mainOnly: "Только главный магазин", saveSelected: "Сохранить выбранный магазин", close: "Закрыть", mainBadge: " (главный)", dir: "ltr" },
  th: { label: "บันทึกรายชื่อติดต่อ", ariaSave: "บันทึกรายชื่อติดต่อ", modalTitle: "เลือกสาขาเพื่อดาวน์โหลด", mainOnly: "เฉพาะสาขาหลัก", saveSelected: "บันทึกสาขาที่เลือก", close: "ปิด", mainBadge: " (สาขาหลัก)", dir: "ltr" },
  vi: { label: "Lưu liên hệ", ariaSave: "Lưu liên hệ", modalTitle: "Chọn cửa hàng để tải xuống", mainOnly: "Chỉ cửa hàng chính", saveSelected: "Lưu cửa hàng đã chọn", close: "Đóng", mainBadge: " (cửa hàng chính)", dir: "ltr" },
  id: { label: "Simpan kontak", ariaSave: "Simpan kontak", modalTitle: "Pilih toko untuk diunduh", mainOnly: "Hanya toko utama", saveSelected: "Simpan toko yang dipilih", close: "Tutup", mainBadge: " (toko utama)", dir: "ltr" },
  hi: { label: "संपर्क सहेजें", ariaSave: "संपर्क सहेजें", modalTitle: "डाउनलोड के लिए स्टोर चुनें", mainOnly: "केवल मुख्य स्टोर", saveSelected: "चयनित स्टोर सहेजें", close: "बंद करें", mainBadge: " (मुख्य)", dir: "ltr" },
  ar: { label: "حفظ جهة الاتصال", ariaSave: "حفظ جهة الاتصال", modalTitle: "اختر المتجر للتنزيل", mainOnly: "المتجر الرئيسي فقط", saveSelected: "حفظ المتجر المحدد", close: "إغلاق", mainBadge: " (الرئيسي)", dir: "rtl" },
};

function tFor(lang: UILang): Dict {
  return I18N[lang] ?? I18N[JA];
}

/* =========================
   Component
========================= */
type StoreDoc = {
  id: string;
  name: string;
  isMain?: boolean;
};

export default function VCardDownloadButton({
  className,
  label, // 省略時は言語に応じたデフォルトを表示
}: {
  className?: string;
  label?: string;
}) {
  const { uiLang } = useUILang();
  const T = tFor(uiLang);
  const [stores, setStores] = useState<StoreDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "siteStores", SITE_KEY, "items"));
      const list: StoreDoc[] = [];
      snap.forEach((doc) => {
        const d = doc.data() as any;
        const name = (d.name ?? d.storeName ?? "").trim();
        if (name) list.push({ id: doc.id, name, isMain: !!d.isMain });
      });
      setStores(list);
      const main = list.find((s) => s.isMain);
      setSelectedId(main?.id ?? list[0]?.id ?? "");
    })();
  }, []);

  // Escで閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const hasMain = useMemo(() => stores.some((s) => s.isMain), [stores]);

  const go = (url: string) => {
    window.location.href = url; // サーバの Content-Disposition でDL
  };

  // クリック時の自動分岐
  const handleClick = () => {
    if (stores.length === 0) {
      // 店舗なし→オーナー情報（UIには出さず自動DL）
      go("/api/vcard");
      return;
    }
    if (hasMain) {
      go("/api/vcard?main=true");
      return;
    }
    if (stores.length === 1) {
      go(`/api/vcard?storeId=${encodeURIComponent(stores[0].id)}`);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <Button
        className={className}
        onClick={handleClick}
        title={label ?? T.ariaSave}
        aria-label={T.ariaSave}
        dir={T.dir}
      >
        <ArrowDownToLine className="mr-2 h-4 w-4" />
        {label ?? T.label}
      </Button>

      {/* ====== ピッカーモーダル（画面センター）====== */}
      {open && (
        <div className="fixed inset-0 z-[100] grid place-items-center" dir={T.dir}>
          {/* 背景 */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* 本体（センター配置） */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="vcard-picker-title"
            className="relative z-10 w-[92vw] max-w-md rounded-2xl bg-white/70 p-4 text-black shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 id="vcard-picker-title" className="flex items-center gap-2 text-white  ">
                <Store className="h-4 w-4 text-black" />
                {T.modalTitle}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={T.close}
                className="rounded-md p-1 hover:bg-black/5"
                title={T.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <select
              className="w-full rounded-md border bg-white p-2 text-black"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              aria-label={T.modalTitle}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isMain ? T.mainBadge : ""}
                </option>
              ))}
            </select>

            <div className="mt-4 flex justify-end gap-2">
              {hasMain && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setOpen(false);
                    go("/api/vcard?main=true");
                  }}
                  title={T.mainOnly}
                >
                  {T.mainOnly}
                </Button>
              )}
              <Button
                type="button"
                onClick={() => {
                  if (!selectedId) return;
                  setOpen(false);
                  go(`/api/vcard?storeId=${encodeURIComponent(selectedId)}`);
                }}
                disabled={!selectedId}
                title={T.saveSelected}
                aria-label={T.saveSelected}
              >
                {T.saveSelected}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
